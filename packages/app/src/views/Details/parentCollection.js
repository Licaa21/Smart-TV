// Which collections a title belongs to.
//
// Jellyfin 12 answers this outright, so on a server carrying that route it is one request.
// Older servers and Emby have nothing of the sort. Ancestors describes the folders above
// an item, and a collection is a link rather than a folder, so a title in one comes back
// with nothing but its library.
//
// On the rest every collection is asked what it holds, since a title can sit in a TMDB
// collection and any number of hand made ones. That is dear enough that the answers are
// kept and the asking done at most once. The TMDB id only decides which collection leads.

const MAX_COLLECTIONS = 500;
const MEMBER_LOOKUPS_AT_ONCE = 8;

const providerId = (item, name) => {
	const ids = item?.ProviderIds;
	if (!ids) return '';
	const key = Object.keys(ids).find((entry) => entry.trim().toLowerCase() === name);
	return key ? String(ids[key] ?? '').trim() : '';
};

// The collection a title names as its own.
const namedCollection = (item, collections) => {
	const wanted = providerId(item, 'tmdbcollection');
	if (!wanted) return null;
	return collections.find((collection) => providerId(collection, 'tmdb') === wanted) || null;
};

// Only the ids and names are read here, and the artwork and watch state the server
// sends by default are the bulk of the answer.
const LEAN = {EnableImages: false, EnableUserData: false, EnableTotalRecordCount: false};

let membershipLookup = null;

// Exported so tests can clear the module state between cases.
export const __resetCollectionMembership = () => {
	membershipLookup = null;
};

// A server without the route answers 404, and so does one asked about a title it does not
// hold. Those cant be told apart, so neither is remembered and a refusal only ever means
// going the long way round.
const directCollections = (api, item) =>
	api.getItemCollections(item.Id).then((result) => result?.Items || []).catch(() => null);

const allCollections = (api) => api.getItems({
	...LEAN,
	IncludeItemTypes: 'BoxSet',
	Recursive: true,
	Limit: MAX_COLLECTIONS,
	Fields: 'ProviderIds'
}).then((result) => result?.Items || []).catch(() => []);

const scanMembership = async (api, collections) => {
	const owners = {};
	for (let start = 0; start < collections.length; start += MEMBER_LOOKUPS_AT_ONCE) {
		const batch = collections.slice(start, start + MEMBER_LOOKUPS_AT_ONCE);
		// eslint-disable-next-line no-await-in-loop
		const batchMembers = await Promise.all(batch.map((collection) => api.getItems({...LEAN, ParentId: collection.Id})
			.then((result) => result?.Items || [])
			.catch(() => [])));
		// Filled in the order the collections were listed, not the order the answers arrived,
		// so a title's collections come out the same way every time.
		batchMembers.forEach((members, index) => {
			members.forEach((member) => {
				if (!member?.Id) return;
				const held = owners[member.Id];
				if (held) held.push(batch[index]);
				else owners[member.Id] = [batch[index]];
			});
		});
	}
	return owners;
};

// The scan itself is kept for the rest of the session, so a title opened while it is still
// running waits on it rather than starting another.
const membershipFor = (api, collections) => {
	if (!membershipLookup) membershipLookup = scanMembership(api, collections);
	return membershipLookup;
};

// The collection a title names is the one it most belongs to, so it leads whatever else
// holds the title.
const namedFirst = (item, collections) => {
	const named = namedCollection(item, collections);
	if (!named) return collections;
	return [named, ...collections.filter((collection) => collection.Id !== named.Id)];
};

export const findParentCollections = async (api, item) => {
	if (!api || !item?.Id) return [];

	// The route hands back every collection the title is in, ordered by name. An empty
	// answer from it settles the question, where a refusal settles nothing.
	const direct = await directCollections(api, item);
	if (direct) return namedFirst(item, direct);

	const collections = await allCollections(api);
	if (collections.length === 0) return [];

	const owners = await membershipFor(api, collections);
	return namedFirst(item, owners[item.Id] || []);
};

export const findParentCollection = async (api, item) => (await findParentCollections(api, item))[0] || null;
