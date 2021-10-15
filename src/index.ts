import { Server } from './Server';
import TopicLockModule from './Modules/CoreModules/TopicLock';
import InvisibleModule from './Modules/CoreModules/Invisible';
import NoExternalMessagesModule from './Modules/CoreModules/NoExternalMessages';
import InviteModule from './Modules/CoreModules/Invite';

const server = new Server({
	serverAddress: 'test.server'
});

server.loadModule(InvisibleModule);

server.loadModule(NoExternalMessagesModule);
server.loadModule(TopicLockModule);

server.loadModule(InviteModule);

server.listen(6667);
console.log('Listening on port 6667');
