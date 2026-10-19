// Servidor com feeds falsos, só para ver a interface sem rede.
const fixture = require('./fixture');
global.fetch = async () => ({ ok: true, text: async () => fixture });
const { server } = require('../server');
server.listen(3100, () => console.log('mock em 3100'));
