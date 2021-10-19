import { InvisibleModule } from './Modules/CoreModules/Invisible';
import { InviteModule } from './Modules/CoreModules/Invite';
import { ListModule } from './Modules/CoreModules/List';
import { NoExternalMessagesModule } from './Modules/CoreModules/NoExternalMessages';
import { TopicLockModule } from './Modules/CoreModules/TopicLock';
import { Server } from './Server';

const server = new Server({
	serverAddress: 'test.server'
});

server.loadModule(InvisibleModule);

server.loadModule(NoExternalMessagesModule);
server.loadModule(TopicLockModule);

server.loadModule(InviteModule);

server.loadModule(ListModule);

server.listen(6667);
console.log('Listening on port 6667');
