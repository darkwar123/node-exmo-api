const request = require('request');
const querystring = require('querystring');

const CryptoJS = require("crypto-js");
const EventEmitter = require('events');

const debug = require('debug')('exmo');

let config = {
	methods: [],
	url: 'https://api.exmo.com/v1/',
	nonce: Math.floor(new Date().getTime()), // increment this each query
};

class Exmo extends EventEmitter {
	/**
	 * Constructor(options)
	 * @param key - exmo apiKey
	 * @param secret - exmo secretKey
	 * @param pollInterval - how often pollData (ticker) will be emitted (default: -1)
	 * */
	constructor({ key = '', secret = '', pollInterval = -1 }) {
		super();
		this.key = key;
		this.secret = secret;
		this.pollInterval = pollInterval;

		if (this.pollInterval > 0) {
			this.doPoll();
		}
	}
	request(method, opts = {}, queryOpts = {}) {
		return new Promise((resolve, reject) => {
			opts.nonce = config.nonce++;

			let data = querystring.stringify(opts);
			let url = !!/^https?:\/\//ig.exec(method) ? method : config.url + method;

			if (queryOpts.method === 'GET') {
				url += '?' + data;
			}

			const options = Object.assign({
				url,
				method: 'POST',
				headers: {
					'Key': this.key,
					'Sign': this.sign(data)
				},
				form: data,
				json: true,
				timeout: 10000,
			}, queryOpts);

			request(options, (err, response = {}, body) => {
				if (err || response.statusCode !== 200) {
					err = err ? err : new Error('HTTP statusCode ' + response.statusCode);

					return reject(err);
				}

				if (typeof body !== 'object' || body === null) {
					return reject('Response isn\'t JSON');
				}

				return resolve(body);
			});
		});
	}
	sign(message) {
		return CryptoJS.HmacSHA512(message, this.secret).toString(CryptoJS.enc.hex);
	}
	doPoll() {
		debug('do poll');

		this.request('ticker')
			.then((data) => {
				this.emit('ticker', data);
				this.emit('pollData', data);
				return setTimeout(this.doPoll.bind(this), this.pollInterval);
			})
			.catch((err) => {
				this.emit('pollError', err);
				debug('poll error %s', err.message);
				return setTimeout(this.doPoll.bind(this), this.pollInterval);
			})
	}
}

module.exports = Exmo;