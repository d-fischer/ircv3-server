import { ChannelKeyModule } from './Modules/CoreModules/ChannelKey';
import { ChannelLimitModule } from './Modules/CoreModules/ChannelLimit';
import { InvisibleModule } from './Modules/CoreModules/Invisible';
import { InviteModule } from './Modules/CoreModules/Invite';
import { KillModule } from './Modules/CoreModules/Kill';
import { ListModule } from './Modules/CoreModules/List';
import { ModeratedModule } from './Modules/CoreModules/Moderated';
import { NoExternalMessagesModule } from './Modules/CoreModules/NoExternalMessages';
import { OperModule } from './Modules/CoreModules/Oper';
import { SecretModule } from './Modules/CoreModules/Secret';
import { TimeModule } from './Modules/CoreModules/Time';
import { TopicLockModule } from './Modules/CoreModules/TopicLock';
import { UserHostModule } from './Modules/CoreModules/UserHost';
import { Server } from './Server';

const server = new Server({
	serverAddress: 'test.server',
	networkName: 'LocalTestNet'
});

server.loadModule(new InvisibleModule());

server.loadModule(new NoExternalMessagesModule());
server.loadModule(new TopicLockModule());
server.loadModule(new SecretModule());
server.loadModule(new ModeratedModule());
server.loadModule(new ChannelKeyModule());
server.loadModule(new ChannelLimitModule());

server.loadModule(new InviteModule());

server.loadModule(new ListModule());
server.loadModule(new UserHostModule());

server.loadModule(new OperModule());
server.loadModule(new KillModule());

server.loadModule(new TimeModule());

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
