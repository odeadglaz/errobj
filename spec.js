const { expect } = require('chai');
const errobj = require('.');

const [ major, minor ] = process.versions.node.split('.').map(Number);
const supportsCause = major > 16 || major === 16 && minor >= 9;

describe('error-notation', () => {
	it('Should convert an error to an object', () => {
		const error = new Error('Everything is okay');

		const obj = errobj(error);
		expect(obj.toString()).to.equal('[object Object]');
	});
	it('Should include all error fields', () => {
		const error = new TypeError('Nothing');
		error.details = { answer: 42 };
		error.code = 'UNKNERR';
		const obj = errobj(error);
		expect(obj.message).to.equal('Nothing');
		expect(obj.name).to.equal('TypeError');
		expect(obj.code).to.equal('UNKNERR');
		expect(obj.details).have.any.keys('answer');
		expect(obj.stack).to.be.a('string');
	});

	it('Should include any custom property attached to the error', () => {
		const error = new RangeError('Nothing');
		error.extra = 'information';
		const { extra } = errobj(error);
		expect(extra).to.equal('information');
	});
	it('Should include enrichment fields', () => {
		const error = new RangeError('Nothing');
		const { extra } = errobj(error, { extra: 'information' });
		expect(extra).to.equal('information');
	});
	it('Should give precedence to enrichment fields over the native ones', () => {
		const error = new RangeError('Nothing');
		const { message } = errobj(error, { message: 'Something' });
		expect(message).to.equal('Something');
	});

	it('Should find line and column from browser error stack', () => {
		const error = new RangeError('Nothing');
		error.stack = `ReferenceError: something is not defined
at change (index.html:46)
at index.html:53
at index.html:56`;
		const { fileName, lineNumber, columnNumber } = errobj(error);
		expect(fileName).to.equal('index.html');
		expect(lineNumber).to.equal(46);
		expect(columnNumber).to.be.undefined;
	});

	it('Should not attach parsedStack by default', () => {
		const error = new RangeError('Nothing');
		error.stack = `ReferenceError: something is not defined
at change (index.html:46)
at index.html:53
at index.html:56`;
		const { parsedStack } = errobj(error);
		expect(parsedStack).to.be.undefined;
	});

	it('Should attach specific lines to parsedStack to the details', () => {
		const error = () => {
			const err = new RangeError('Nothing');
			err.stack = `ReferenceError: something is not defined
at change (index.html:46)
at index.html:53
at index.html:56`;
			return err;
		};
		expect(errobj(error(), null, { parsedStack: true }).parsedStack).to.have.lengthOf(3);
		expect(errobj(error(), null, { parsedStack: Infinity }).parsedStack).to.have.lengthOf(3);
		expect(errobj(error(), null, { parsedStack: 2 }).parsedStack).to.have.lengthOf(2);
		expect(errobj(error(), null, { parsedStack: false }).parsedStack).to.be.undefined;
	});

	it('Should find line and column from nodejs error stack', () => {
		const error = new RangeError('Nothing');
		error.stack = `at /app/dist/apps/listings/server.js:1329:40
at Array.filter (<anonymous>)
at Object.category (/app/dist/apps/listings/server.js:1327:37)
at buildSubCategoryFilter (/app/dist/apps/listings/server.js:40171:31)
at buildAppFilters (/app/dist/apps/listings/server.js:40145:18)
at Object.listingsResult (/app/dist/apps/listings/server.js:29813:22)
at /app/dist/apps/listings/server.js:27177:21
at process._tickCallback (internal/process/next_tick.js:68:7)`;
		const { fileName, lineNumber, columnNumber } = errobj(error);
		expect(fileName).to.equal('/app/dist/apps/listings/server.js');
		expect(lineNumber).to.equal(1329);
		expect(columnNumber).to.equal(40);
	});

	it('Should find line and column from browser error stack', () => {
		const error = new RangeError('Nothing');
		error.stack = `TypeError: Cannot read property 'gf' of undefined
at t.r.getPageLoadTime (https://cdn.website.com/assets/application.js:1:284663)
at d (https://cdn.website.com/assets/business-logic.js:1:286145)
at https://connect.facebook.net/en_US/fbevents.js:25:21849
at HTMLIFrameElement.b (https://connect.facebook.net/en_US/fbevents.js:24:3061)`;
		const { fileName, lineNumber, columnNumber } = errobj(error);
		expect(fileName).to.equal('https://cdn.website.com/assets/application.js');
		expect(lineNumber).to.equal(1);
		expect(columnNumber).to.equal(284663);
	});

	it('Should prefer existing lineNumber and columnNumber', () => {
		const error = new RangeError('Nothing');
		error.lineNumber = 2;
		error.columnNumber = 4;
		error.stack = `TypeError: Cannot read property 'gf' of undefined
at t.r.getPageLoadTime (https://cdn.website.com/assets/application.js:1:284663)
at d (https://cdn.website.com/assets/business-logic.js:1:286145)
at https://connect.facebook.net/en_US/fbevents.js:25:21849
at HTMLIFrameElement.b (https://connect.facebook.net/en_US/fbevents.js:24:3061)`;
		const { lineNumber, columnNumber } = errobj(error);
		expect(lineNumber).to.equal(2);
		expect(columnNumber).to.equal(4);
	});

	it('Should offset the parsed stack trace', () => {
		const error = new RangeError('Nothing');
		error.stack = `TypeError: Cannot read property 'gf' of undefined
at t.r.getPageLoadTime (https://cdn.website.com/assets/application.js:1:284663)
at d (https://cdn.website.com/assets/business-logic.js:4:286145)
at https://connect.facebook.net/en_US/fbevents.js:25:21849
at HTMLIFrameElement.b (https://connect.facebook.net/en_US/fbevents.js:24:3061)`;
		let lineNumber, columnNumber;
		({ lineNumber, columnNumber } = errobj(error, null, { offset: 1 }));
		expect(lineNumber).to.equal(4);
		expect(columnNumber).to.equal(286145);

		({ lineNumber, columnNumber } = errobj(error, null, { offset: 2 }));
		expect(lineNumber).to.equal(25);
		expect(columnNumber).to.equal(21849);
	});

	it('Should support errors with a toJSON function', () => {
		class CustomError extends Error {
			toJSON() {
				return {
					message: 'Custom wrong thing',
					stack: this.stack,
				};
			}
		}

		const error = new CustomError('Something must have gone terribly wrong');
		error.stack = `TypeError: Cannot read property 'gf' of undefined
at t.r.getPageLoadTime (https://cdn.website.com/assets/application.js:1:284663)
at d (https://cdn.website.com/assets/business-logic.js:1:286145)
at https://connect.facebook.net/en_US/fbevents.js:25:21849
at HTMLIFrameElement.b (https://connect.facebook.net/en_US/fbevents.js:24:3061)`;

		const { message, lineNumber, columnNumber, extra } = errobj(error, { extra: 'additional info' });
		expect(message).to.equal('Custom wrong thing');
		expect(lineNumber).to.equal(1);
		expect(columnNumber).to.equal(284663);
		expect(extra).to.equal('additional info');
	});
	supportsCause && it('should print cause string', () => {
		const error = new Error('Something must have gone terribly wrong', { cause: 'something horrible' });
		const { cause } = errobj(error);
		expect(cause).to.equal('something horrible');
	});
	supportsCause && it('should print cause string', () => {
		const error = new Error('Something must have gone terribly wrong');
		expect(Object.keys(errobj(error))).not.to.include('cause');
	});
	supportsCause && it('should parse cause error', () => {
		const err = new Error('something horrible');
		const error = new Error('Something must have gone terribly wrong', { cause: err });
		const original = errobj(err);
		const { cause } = errobj(error);
		expect(cause).to.equal(JSON.stringify(original));
	});
	supportsCause && it('should escape circular reference in cause', () => {
		const error = new Error('Something must have gone terribly wrong');
		error.cause = error;
		const { cause } = errobj(error);
		expect(cause).to.equal('[Circular]');
	});
});
