import {
	FriendsView, FriendProfileView, RequestsView, FindPeopleView, PrivacyView,
	MessagesView, PickFriendView, NewGroupView, ChatView, GroupInfoView, AddMembersView
} from './FriendsViews';

// Every friends and chat screen renders from here. A screen that needs to know which person or
// chat it is about reads that from the view it was pushed with.
export const FRIENDS_VIEWS = [
	'friends', 'friendProfile', 'friendsRequests', 'friendsAdd', 'friendsPrivacy',
	'friendsMessages', 'chatPick', 'chatNewGroup', 'chat', 'chatGroupInfo', 'chatAddMembers'
];

const FriendsScreens = ({view, params = {}, onOpen, onBack, onSelectItem}) => {
	switch (view) {
		case 'friendProfile':
			return <FriendProfileView userId={params.userId} name={params.name} onOpen={onOpen} onBack={onBack} onSelectItem={onSelectItem} />;
		case 'friendsRequests':
			return <RequestsView />;
		case 'friendsAdd':
			return <FindPeopleView />;
		case 'friendsPrivacy':
			return <PrivacyView />;
		case 'friendsMessages':
			return <MessagesView onOpen={onOpen} />;
		case 'chatPick':
			return <PickFriendView onOpen={onOpen} />;
		case 'chatNewGroup':
			return <NewGroupView onOpen={onOpen} onBack={onBack} />;
		case 'chat':
			return <ChatView conversationId={params.conversationId} name={params.name} isGroup={params.isGroup} onOpen={onOpen} />;
		case 'chatGroupInfo':
			return <GroupInfoView conversationId={params.conversationId} onOpen={onOpen} onBack={onBack} />;
		case 'chatAddMembers':
			return <AddMembersView conversationId={params.conversationId} onBack={onBack} />;
		default:
			return <FriendsView onOpen={onOpen} />;
	}
};

export default FriendsScreens;
