using Windows.Data.Json;

namespace Moonfin.Xbox
{
    // One message from the page, already checked for shape.
    internal sealed class PageMessage
    {
        public string Type;
        // Null when the page sent none, or sent something that isnt an object.
        public JsonObject Payload;
    }

    // Messages between the web app and this host.
    //
    // The page talks to the host with window.chrome.webview.postMessage, which is
    // given one JSON string. The host talks to the page by running a script that
    // dispatches a moonfin:xbox CustomEvent on window. Both directions carry the same
    // envelope, and the version lets either side refuse what it doesnt understand.
    // The page side is packages/platform-xbox/src/bridge.js.
    //
    // Page to host:
    //   EXIT_APP
    //   KEEP_DISPLAY_ACTIVE  {active}
    //   PLAYBACK_SESSION     {stopUrl, headers, body} or null
    //   ALLOW_INSECURE_HOST  {host}
    //
    // Host to page:
    //   APP_STATE  {state: "active" | "background"}
    //   NETWORK    {connected, ip}
    //   KEY        {key}
    internal static class Bridge
    {
        public const int Version = 1;
        public const string PageEvent = "moonfin:xbox";

        // Nothing the page sends comes near this. A longer message is dropped unread.
        public const int MaxMessageLength = 64 * 1024;

        public static PageMessage Parse(string raw)
        {
            if (string.IsNullOrEmpty(raw) || raw.Length > MaxMessageLength) return null;
            if (!JsonObject.TryParse(raw, out JsonObject envelope)) return null;

            IJsonValue version = Named(envelope, "v");
            if (version == null || version.ValueType != JsonValueType.Number || version.GetNumber() != Version) return null;

            IJsonValue type = Named(envelope, "type");
            if (type == null || type.ValueType != JsonValueType.String) return null;

            var message = new PageMessage { Type = type.GetString() };

            IJsonValue payload = Named(envelope, "payload");
            if (payload != null && payload.ValueType == JsonValueType.Object) message.Payload = payload.GetObject();

            return message;
        }

        // A script for ExecuteScriptAsync that hands the page one message.
        public static string ToPageScript(string type, IJsonValue payload)
        {
            return DispatchScript(Envelope(type, payload));
        }

        // Runs before any page code, so the app can read the console and its address
        // synchronously at boot instead of waiting on a message round trip.
        public static string BootScript(JsonObject data)
        {
            data.SetNamedValue("v", JsonValue.CreateNumberValue(Version));
            return "window.__MOONFIN_XBOX__ = " + data.Stringify() + ";";
        }

        // The named value, or null when the object has none by that name.
        public static IJsonValue Named(JsonObject source, string name)
        {
            return source != null && source.ContainsKey(name) ? source.GetNamedValue(name) : null;
        }

        public static string NamedString(JsonObject source, string name)
        {
            IJsonValue value = Named(source, name);
            return value != null && value.ValueType == JsonValueType.String ? value.GetString() : null;
        }

        private static JsonObject Envelope(string type, IJsonValue payload)
        {
            var envelope = new JsonObject();
            envelope.SetNamedValue("v", JsonValue.CreateNumberValue(Version));
            envelope.SetNamedValue("type", JsonValue.CreateStringValue(type));
            if (payload != null) envelope.SetNamedValue("payload", payload);
            return envelope;
        }

        private static string DispatchScript(JsonObject envelope)
        {
            return "window.dispatchEvent(new CustomEvent(" + JsonValue.CreateStringValue(PageEvent).Stringify() + ", {detail: " + envelope.Stringify() + "}));";
        }
    }
}
