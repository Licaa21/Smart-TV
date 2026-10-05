using Microsoft.Web.WebView2.Core;
using System;
using System.Threading;
using System.Threading.Tasks;
using Windows.Storage.Streams;
using Windows.Web.Http;
using Windows.Web.Http.Filters;

namespace Moonfin.Xbox
{
    // Requests the page may read across origins although the far side doesnt say so.
    //
    // On the TVs an app's page isnt held to CORS, and the app counts on that in one
    // place: it asks YouTube's player API where a trailer's stream is, and YouTube
    // answers without the header that would let a web page read the reply. The
    // WebView here does hold the page to CORS, so that one request is made by the
    // host instead and handed back with the header in place. Nothing else is
    // relayed, and nothing of the user's goes along: no cookies, and only the
    // content type and user agent of what the page sent.
    internal static class CorsRelay
    {
        // What the WebView is told to bring here.
        public const string Filter = "https://www.youtube.com/youtubei/v1/*";

        private const string AllowedPrefix = "https://www.youtube.com/youtubei/v1/";
        private const uint MaxRequestBytes = 64 * 1024;
        private const uint MaxResponseBytes = 4 * 1024 * 1024;
        private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(10);

        public static bool Handles(string address)
        {
            return address != null && address.StartsWith(AllowedPrefix, StringComparison.OrdinalIgnoreCase);
        }

        // Null when the request couldnt be relayed, which leaves it to the WebView.
        public static async Task<CoreWebView2WebResourceResponse> RelayAsync(CoreWebView2Environment environment, CoreWebView2WebResourceRequest request, string pageOrigin)
        {
            try
            {
                using (var filter = new HttpBaseProtocolFilter())
                {
                    filter.CookieUsageBehavior = HttpCookieUsageBehavior.NoCookies;
                    filter.CacheControl.ReadBehavior = HttpCacheReadBehavior.NoCache;
                    filter.CacheControl.WriteBehavior = HttpCacheWriteBehavior.NoCache;

                    using (var client = new HttpClient(filter))
                    using (var outgoing = new HttpRequestMessage(new HttpMethod(request.Method), new Uri(request.Uri)))
                    using (var cancel = new CancellationTokenSource(Timeout))
                    {
                        string userAgent = Header(request, "User-Agent");
                        if (userAgent != null) outgoing.Headers.TryAppendWithoutValidation("User-Agent", userAgent);

                        IBuffer body = await ReadAsync(request.Content, MaxRequestBytes);
                        if (body != null)
                        {
                            var content = new HttpBufferContent(body);
                            content.Headers.TryAppendWithoutValidation("Content-Type", Header(request, "Content-Type") ?? "text/plain;charset=UTF-8");
                            outgoing.Content = content;
                        }

                        HttpResponseMessage answer = await client.SendRequestAsync(outgoing).AsTask(cancel.Token);
                        IBuffer answerBody = await answer.Content.ReadAsBufferAsync().AsTask(cancel.Token);
                        if (answerBody.Length > MaxResponseBytes) return null;

                        var stream = new InMemoryRandomAccessStream();
                        using (var writer = new DataWriter(stream))
                        {
                            writer.WriteBuffer(answerBody);
                            await writer.StoreAsync();
                            await writer.FlushAsync();
                            writer.DetachStream();
                        }
                        stream.Seek(0);

                        // The WebView wants the headers one to a line, and a reason even where
                        // HTTP/2 gave none.
                        string contentType = answer.Content.Headers.ContentType != null ? answer.Content.Headers.ContentType.ToString() : "application/json";
                        string headers = "Content-Type: " + contentType + "\nAccess-Control-Allow-Origin: " + pageOrigin + "\nCache-Control: no-store";
                        string reason = string.IsNullOrEmpty(answer.ReasonPhrase) ? (answer.IsSuccessStatusCode ? "OK" : "Error") : answer.ReasonPhrase;
                        return environment.CreateWebResourceResponse(stream, (int)answer.StatusCode, reason, headers);
                    }
                }
            }
            catch (Exception ex)
            {
                HostLog.Write("relay", request.Uri + " failed: " + ex.Message);
                return null;
            }
        }

        public static string Header(CoreWebView2WebResourceRequest request, string name)
        {
            return request.Headers.Contains(name) ? request.Headers.GetHeader(name) : null;
        }

        private static async Task<IBuffer> ReadAsync(IRandomAccessStream content, uint limit)
        {
            if (content == null || content.Size == 0) return null;
            if (content.Size > limit) throw new InvalidOperationException("The request is larger than the relay takes");
            using (var reader = new DataReader(content.GetInputStreamAt(0)))
            {
                uint size = (uint)content.Size;
                await reader.LoadAsync(size);
                return reader.ReadBuffer(size);
            }
        }
    }
}
