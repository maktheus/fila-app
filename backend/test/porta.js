// Porta livre para os servidores de teste.
//
// Antes cada suite sorteava uma porta numa faixa de algumas centenas. Com meia
// duzia de instancias no mesmo run, a chance de duas sortearem a mesma passa de
// 5% — e a colisao aparecia como um "not ok" aleatorio no CI, sempre em suite
// diferente. Aqui pedimos a porta ao sistema operacional e guardamos as ja
// entregues, para nem o sorteio nem a reciclagem do SO repetirem uma.

const net = require('node:net');

const entregues = new Set();

async function portaLivre() {
  for (let tentativa = 0; tentativa < 50; tentativa++) {
    const porta = await new Promise((resolve, reject) => {
      const servidor = net.createServer();
      servidor.unref();
      servidor.on('error', reject);
      servidor.listen(0, '127.0.0.1', () => {
        const { port } = servidor.address();
        servidor.close(() => resolve(port));
      });
    });
    if (!entregues.has(porta)) {
      entregues.add(porta);
      return porta;
    }
  }
  throw new Error('nao consegui uma porta livre para o servidor de teste');
}

module.exports = { portaLivre };
