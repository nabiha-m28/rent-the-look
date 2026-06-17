
const { ProxyAgent, fetch } = require('undici');

(async () => {

  const proxyUrl = 'http://scrapeops:7dac5bfe-07be-4738-ad39-e9a3459d8d61@residential-proxy.scrapeops.io:8181';

  const proxyAgent = new ProxyAgent(proxyUrl);

  try {

    const response = await fetch('https://api.ipify.org?format=json', { dispatcher: proxyAgent });

    console.log('Status:', response.status);

    const body = await response.text();

    console.log('IP via proxy:', body);

  } catch (error) {

    console.log('error:', error.message);

    console.log('cause:', error.cause);

  }

})();

