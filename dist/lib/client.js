"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var Request = require("request-promise-native");
var events_1 = require("events");
var transport_1 = require("./transport");
var payment_1 = require("./payment");
var log_1 = require("./util/log");
var LOG = log_1.default('Client');
var AcceptPaymentRequest = /** @class */ (function () {
    function AcceptPaymentRequest(payment) {
        this.payment = payment;
    }
    return AcceptPaymentRequest;
}());
exports.AcceptPaymentRequest = AcceptPaymentRequest;
var AcceptPaymentRequestSerde = /** @class */ (function () {
    function AcceptPaymentRequestSerde() {
    }
    AcceptPaymentRequestSerde.prototype.serialize = function (obj) {
        return {
            payment: payment_1.PaymentSerde.instance.serialize(obj.payment)
        };
    };
    AcceptPaymentRequestSerde.prototype.deserialize = function (data) {
        if (!data.payment) {
            throw new Error('Cannot deserialize payment request. Payment is missing.');
        }
        var payment = payment_1.PaymentSerde.instance.deserialize(data.payment);
        return new AcceptPaymentRequest(payment);
    };
    AcceptPaymentRequestSerde.instance = new AcceptPaymentRequestSerde();
    return AcceptPaymentRequestSerde;
}());
exports.AcceptPaymentRequestSerde = AcceptPaymentRequestSerde;
var AcceptPaymentResponse = /** @class */ (function () {
    function AcceptPaymentResponse(token) {
        this.token = token;
    }
    return AcceptPaymentResponse;
}());
exports.AcceptPaymentResponse = AcceptPaymentResponse;
var AcceptPaymentResponseSerde = /** @class */ (function () {
    function AcceptPaymentResponseSerde() {
    }
    AcceptPaymentResponseSerde.prototype.serialize = function (obj) {
        return {
            token: obj.token
        };
    };
    AcceptPaymentResponseSerde.prototype.deserialize = function (data) {
        if (!data.token) {
            throw new Error('Cannot deserialize payment response. Token is missing.');
        }
        return new AcceptPaymentResponse(data.token);
    };
    AcceptPaymentResponseSerde.instance = new AcceptPaymentResponseSerde();
    return AcceptPaymentResponseSerde;
}());
exports.AcceptPaymentResponseSerde = AcceptPaymentResponseSerde;
var AcceptTokenRequest = /** @class */ (function () {
    function AcceptTokenRequest(token) {
        this.token = token;
    }
    return AcceptTokenRequest;
}());
exports.AcceptTokenRequest = AcceptTokenRequest;
var AcceptTokenRequestSerde = /** @class */ (function () {
    function AcceptTokenRequestSerde() {
    }
    AcceptTokenRequestSerde.prototype.serialize = function (obj) {
        return {
            token: obj.token
        };
    };
    AcceptTokenRequestSerde.prototype.deserialize = function (data) {
        if (!data.token) {
            throw new Error('Cannot deserialize token request. Token is missing.');
        }
        return new AcceptTokenRequest(data.token);
    };
    AcceptTokenRequestSerde.instance = new AcceptTokenRequestSerde();
    return AcceptTokenRequestSerde;
}());
exports.AcceptTokenRequestSerde = AcceptTokenRequestSerde;
var AcceptTokenResponse = /** @class */ (function () {
    function AcceptTokenResponse(status) {
        this.status = status;
    }
    return AcceptTokenResponse;
}());
exports.AcceptTokenResponse = AcceptTokenResponse;
var AcceptTokenResponseSerde = /** @class */ (function () {
    function AcceptTokenResponseSerde() {
    }
    AcceptTokenResponseSerde.prototype.serialize = function (obj) {
        return {
            status: obj.status
        };
    };
    AcceptTokenResponseSerde.prototype.deserialize = function (data) {
        if (data.status === undefined) {
            throw new Error('Cannot deserialize token response. Status is missing.');
        }
        return new AcceptTokenResponse(data.status);
    };
    AcceptTokenResponseSerde.instance = new AcceptTokenResponseSerde();
    return AcceptTokenResponseSerde;
}());
exports.AcceptTokenResponseSerde = AcceptTokenResponseSerde;
var ClientImpl = /** @class */ (function (_super) {
    __extends(ClientImpl, _super);
    function ClientImpl(transport, channelManager) {
        var _this = _super.call(this) || this;
        _this.transport = transport;
        _this.channelManager = channelManager;
        return _this;
    }
    ClientImpl.prototype.doPreflight = function (uri) {
        var _this = this;
        this.emit('willPreflight');
        return this.transport.get(uri).then(function (res) {
            _this.emit('didPreflight');
            switch (res.statusCode) {
                case transport_1.STATUS_CODES.PAYMENT_REQUIRED:
                case transport_1.STATUS_CODES.OK:
                    return _this.handlePaymentRequired(res);
                default:
                    throw new Error('Received bad response from content server.');
            }
        });
    };
    ClientImpl.prototype.doPayment = function (payment, gateway) {
        var _this = this;
        this.emit('willSendPayment');
        LOG("Attempting to send payment to " + gateway + ". Sender: " + payment.sender + " / Receiver: " + payment.receiver + " / Amount: " + payment.price.toString());
        var request = new AcceptPaymentRequest(payment);
        return Request.post(gateway, {
            json: true,
            body: AcceptPaymentRequestSerde.instance.serialize(request)
        }).then(function (res) {
            var deres = AcceptPaymentResponseSerde.instance.deserialize(res);
            LOG("Successfully sent payment to " + gateway + ".");
            _this.emit('didSendPayment');
            return deres;
        });
    };
    ClientImpl.prototype.acceptPayment = function (req) {
        var payment = req.payment;
        LOG("Received payment request. Sender: " + payment.sender + " / Receiver: " + payment.receiver);
        return this.channelManager.acceptPayment(payment)
            .then(function (token) {
            LOG("Accepted payment request. Sender: " + payment.sender + " / Receiver: " + payment.receiver);
            return new AcceptPaymentResponse(token);
        });
    };
    ClientImpl.prototype.doVerify = function (token, gateway) {
        var _this = this;
        this.emit('willVerifyToken');
        LOG("Attempting to verify token with " + gateway + ".");
        var request = new AcceptTokenRequest(token);
        return Request.post(gateway, {
            json: true,
            body: AcceptTokenRequestSerde.instance.serialize(request)
        }).then(function (res) {
            var deres = AcceptTokenResponseSerde.instance.deserialize(res);
            LOG("Successfully verified token with " + gateway + ".");
            _this.emit('didVerifyToken');
            return deres;
        }).catch(function () { return new AcceptTokenResponse(false); });
    };
    ClientImpl.prototype.acceptVerify = function (req) {
        return this.channelManager.verifyToken(req.token)
            .then(function (res) { return new AcceptTokenResponse(res); })
            .catch(function () { return new AcceptTokenResponse(false); });
    };
    ClientImpl.prototype.handlePaymentRequired = function (res) {
        var headers = res.headers;
        ClientImpl.REQUIRED_HEADERS.forEach(function (name) {
            var header = ClientImpl.HEADER_PREFIX + "-" + name;
            if (!headers[header]) {
                throw new Error("Missing required header: " + header);
            }
        });
        return transport_1.PaymentRequired.parse(headers);
    };
    ClientImpl.HEADER_PREFIX = 'paywall';
    ClientImpl.REQUIRED_HEADERS = [
        'version',
        'address',
        'price',
        'gateway'
    ];
    return ClientImpl;
}(events_1.EventEmitter));
exports.ClientImpl = ClientImpl;
//# sourceMappingURL=client.js.map