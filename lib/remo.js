var mongoose = require('mongoose')

var options = {

  /**
   * URL prefix for a REST requests. Defaults to '/remo'
   * @type {string}
   */
  url: '/remo',

  /**
   * Debug mode state. Defaults to false.
   * @type {boolean}
   */
  debug: false,

  /**
   * Existing Mongoose connection reference.
   * If empty, the module will try to open connection using the URI below.
   * @type {mixed}
   */
  mongoose: null,

  /**
   * Mongoose connection URI.
   * Will be ignored if 'mongoose' option is set.
   */
  mongooseUri: '',
}

/**
 * Applies REST routes to the application.
 * @param {object} app Express application instance.
 * @param {object} _options Options hash. See options above.
 */
module.exports.serve = function(app, _options) {
  for (var k in _options || {}) {
    options[k] = _options[k]
  }

  // Check if mongoose connection needs to be opened first.
  if (!options.mongoose) {
    if (!options.mongooseUri) {
      throw new Error('Either "mongoose" or "mongooseUri" options required.')
    }
    options.mongoose = mongoose.connect(options.mongooseUri)
  }

  // Handle connection error
  options.mongoose.connection.on('error', function(err) {
    throw new Error("Mongoose connection failed. Check the HURR-DURR. Also check connection options.")
  })

  // Apply URL rules to application on connect.
  options.mongoose.connection.on('connected', function() {
    var actions = require('./actions')(options)
    var prefix = options.url

    app.get(prefix + '/:alias', actions.list)
    app.get(prefix + '/:alias/:id', actions.get)
    app.post(prefix + '/:alias', actions.create)
    app.put(prefix + '/:alias/:id', actions.update)
    app.delete(prefix + '/:alias/:id', actions.delete)
  })

  return app
}
