import Server from './Server';
import TopicLockModule from './Modules/CoreModules/TopicLock';
import InvisibleModule from './Modules/CoreModules/Invisible';
import NoExternalMessagesModule from './Modules/CoreModules/NoExternalMessages';
import InviteModule from './Modules/CoreModules/Invite';

const _server = new Server({
	serverAddress: 'test.server'
});

_server.loadModule(InvisibleModule);

_server.loadModule(NoExternalMessagesModule);
_server.loadModule(TopicLockModule);

_server.loadModule(InviteModule);

_server.listen(6667);
