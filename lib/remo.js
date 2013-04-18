var mongoose = require('mongoose')
  , _ = require('underscore')

var defaultOptions = {

  /**
   * URL prefix for a REST requests. Defaults to '/remo'.
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

  /**
   * Url suffix for COUNT action. Defaults to 'count'.
   * Because of using the same URL pattern as for GET action (/:alias/:id) the
   * COUNT action may blocks getting an entity with ID = 'count' (kekeke). Override
   * this option with something like '_count' or '__count' (or even '___count'!)
   * if so. Then COUNT url will looks like '/thing/_count'.
   */
  countAction: 'count',
}

/**
 * Applies REST routes to the application.
 * @param {object} app Express application instance.
 * @param {object} _options Options hash. See options above.
 */
module.exports.serve = function(app, _options) {
  var options = _.clone(defaultOptions)
  for (var k in _options || {}) {
    options[k] = _options[k]
  }

  // Check if mongoose connection needs to be opened first.
  if (!options.mongoose) {
    // Validate mongoose URI
    if (!options.mongooseUri) {
      throw new Error('Either "mongoose" or "mongooseUri" options required.')
    }
    if ('string' !== typeof options.mongooseUri) {
      throw new Error('"mongooseUri" option should be a string.')
    }
    // Open connection.
    options.mongoose = mongoose.connect(options.mongooseUri)
  }

  // Validate mongoose instance.
  if ('undefined' === typeof options.mongoose.connection) {
    throw new Error('Mongoose instance should have "connection" property.')
  }

  // Handle connection error
  options.mongoose.connection.on('error', function(err) {
    throw new Error("Mongoose connection error. Check the HURR-DURR. Also check connection options.")
  })

  // Apply URL rules to the application.
  var actions = require('./actions')(options)
  var prefix = options.url

  app.get(prefix + '/:alias', actions.list)
  app.get(prefix + '/:alias/' + options.countAction, actions.count)
  app.get(prefix + '/:alias/:id', actions.get)
  app.post(prefix + '/:alias', actions.create)
  app.put(prefix + '/:alias/:id', actions.update)
  app.delete(prefix + '/:alias/:id', actions.delete)

  return app
}
