import { InvisibleModule } from './Modules/CoreModules/Invisible';
import { InviteModule } from './Modules/CoreModules/Invite';
import { ListModule } from './Modules/CoreModules/List';
import { NoExternalMessagesModule } from './Modules/CoreModules/NoExternalMessages';
import { OperModule } from './Modules/CoreModules/Oper';
import { TopicLockModule } from './Modules/CoreModules/TopicLock';
import { UserHostModule } from './Modules/CoreModules/UserHost';
import { Server } from './Server';

const server = new Server({
	serverAddress: 'test.server'
});

server.loadModule(InvisibleModule);

server.loadModule(NoExternalMessagesModule);
server.loadModule(TopicLockModule);

server.loadModule(InviteModule);

server.loadModule(ListModule);
server.loadModule(UserHostModule);

server.loadModule(OperModule);

server.addOperLogin({
	userName: 'testLocal',
	password: 'localPass'
});
server.addOperLogin({
	userName: 'testGlobal',
	password: 'globalPass',
	global: true
});

server.listen(6667);
console.log('Listening on port 6667');
