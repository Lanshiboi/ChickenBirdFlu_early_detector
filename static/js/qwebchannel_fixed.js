/**
 * QWebChannel JavaScript library for PyQt5 WebEngine
 * This file provides the QWebChannel functionality needed for communication
 * between the Python backend and JavaScript frontend
 */

(function() {
    'use strict';

    // QWebChannel constructor
    window.QWebChannel = function(transport, initCallback) {
        if (typeof transport === 'undefined') {
            throw new Error('QWebChannel transport is not available');
        }

        this.transport = transport;
        this.objects = {};

        var self = this;
        this.transport.onmessage = function(message) {
            var data = JSON.parse(message.data);
            if (data.type === 'init') {
                self.objects = data.objects;
                if (initCallback) {
                    initCallback(self);
                }
            }
        };

        // Send initialization request
        this.transport.send(JSON.stringify({type: 'init'}));
    };

    // Polyfill for older browsers
    if (typeof window.qt === 'undefined') {
        window.qt = {};
    }

    if (typeof window.qt.webChannelTransport === 'undefined') {
        // Create a mock transport for development
        window.qt.webChannelTransport = {
            send: function(message) {
                console.log('QWebChannel message:', message);
            },
