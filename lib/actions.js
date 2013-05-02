var _ = require('underscore')

module.exports = function(options) {

  var mongoose = options.mongoose

  var util = {}
  /**
   * Converts entity alias to mongoose model name.
   * Defaults to the alias's "uppercase-first" form, i.e.
   *  'mymodel'  -> 'Mymodel'
   *  'my_model' -> 'My_model'
   *  'MyModel'  -> 'MyModel'
   * Overrideable by "options.aliasToName"
   *
   * @param {string} alias Entity alias.
   * @return {string} Converted alias
   */
  util.aliasToName = options.aliasToName || function(alias) {
    return alias.charAt(0).toUpperCase() + alias.substr(1, alias.length)
  }

  /**
   * Outputs the given message only if debug mode is enabled.
   * @params {string} message Message to output.
   * @return {boolean} false if debug is disabled, true otherwise.
   */
  util.logIfDebug = function(message) {
    if (!options.debug) {
      return false
    }
    console.log(message)
    return true
  }

  /**
   * Returns mongoose model instance by the given name.
   * Sends 404 on missing schema, 500 on unknown error.
   *
   * @param {string} name Model name.
   * @param {object} res HTTP response reference (to send errors if any).
   * @return {object} Mongoose model instance or null on error.
   */
  util.modelByName = function(name, res) {
    if (!res) res = {send: function() {}}
    try {
      return options.mongoose.model(name)
    } catch (err) {
      util.logIfDebug(err)
      if (err.name === 'MissingSchemaError') {
        res.send(404)
      } else {
        res.send(500, err)
      }
      return null
    }
  }

  /**
   * Checks if a callback for the model/action is defined in options.callbacks
   * and returns it (if any).
   *
   * @param {string} name Model name.
   * @param {string} action Action name.
   * @return {mixed} Callback reference or null if undefined.
   */
  util.resolveCallback = function(name, action) {
    if (!options.callbacks || !options.callbacks[name]) {
      return null
    }
    return options.callbacks[name][action]
  }

  return {
    /**
     * Retrieve an entities list.
     *
     * req.params:
     *   + alias: Entity name
     * req.query:
     *   + find (where,q) : Search condition
     *   + limit (lim)    : Limit value
     *   + populate (pop) : Population expression
     *   + skip           : How much results should be skipped
     *   + sort           : Sort expression
     */
    list: function(req, res) {
      var alias = req.params.alias
        , q = req.query
        , name = util.aliasToName(alias)
        , model = util.modelByName(name)
        , query = model.find()

      // Chain query options.
      _.each(q, function(v, k) {
        if (['where', 'q'].indexOf(k) !== -1) k = 'find' // 'find' aliases.
        if (['lim'].indexOf(k) !== -1) k = 'limit' // 'limit' aliases.
        if (['pop'].indexOf(k) !== -1) k = 'populate' // 'populate' aliases.
        if (typeof query[k] === 'function') query = query[k].call(query, v)
        return this
      })
      query = query.find({_destroy: {$ne: true}})

      // Execute query.
      query.exec(function(err, response) {
        if (err) {
          util.logIfDebug(err)
          return res.send(500, err)
        }
        return res.send(response)
      })
    },

    /**
     * Retrieve an entities count.
     *
     * req.params:
     *   + alias: Entity name
     * req.query:
     *   + find (where,q) : Search condition
     */
    count: function(req, res) {
      var alias = req.params.alias
        , q = req.query
        , name = util.aliasToName(alias)
        , model = util.modelByName(name)
        , query = model.find()

      // Chain query options.
      _.each(q, function(v, k) {
        if (['where', 'q'].indexOf(k) !== -1) k = 'find' // 'find' aliases.
        if (typeof query[k] === 'function') query = query[k].call(query, v)
        return this
      })

      // Execute query.
      query.count().exec(function(err, response) {
        if (err) {
          util.logIfDebug(err)
          return res.send(500, err)
        }
        return res.send({response: response})
      })
    },

    /**
     * Retrieve an entity by ID.
     *
     * req.params:
     *   + alias: Entity name
     *   + id:    Entity ID
     * req.query:
     *   + populate: Population expression
     */
    get: function(req, res) {
      var alias = req.params.alias
        , id = req.params.id
        , query = req.query || {}
      var name = util.aliasToName(alias)
      util.modelByName(name).findById(id)
        .populate(query.populate || '')
        .exec(function(err, model) {
          if (err) {
            util.logIfDebug(err)
            return res.send(500, err)
          }
          if (!model) {
            return res.send(404)
          }
          return res.send(model)
        })
    },

    /**
     * Create an entity.
     *
     * req.params:
     *   + alias: Entity name
     * req.body: Attributes hash
     */
    create: function(req, res) {
      var alias = req.params.alias
      var name = util.aliasToName(alias)
      var document = new (util.modelByName(name))(req.body)
      document.save(function(err, document) {
        if (err) {
          util.logIfDebug(err)
          return res.send(500, err)
        }
        res.send(document)
        var cb = util.resolveCallback(name, 'create')
        return 'function' === typeof cb ? cb.call(document) : document
      })
    },

    /**
     * Update an entity.
     *
     * req.params:
     *   + alias: Entity name
     *   + id:    Entity ID
     * req.body: Attributes hash
     */
    update: function(req, res) {
      var alias = req.params.alias
        , id = req.params.id
      var name = util.aliasToName(alias)
      util.modelByName(name)
        .findByIdAndUpdate(id, _.omit(req.body, '_id'))
        .exec(function(err, model) {
          if (err) {
            util.logIfDebug(err)
            return res.send(500, err)
          }
          res.send(model)
          var cb = util.resolveCallback(name, 'update')
          return 'function' === typeof cb ? cb.call(model) : model
        })
    },

    /**
     * Delete an entity.
     *
     * req.params:
     *   + alias: Entity name
     *   + id:    Entity ID
     * req.headers:
     *   + x-remo-mw: Whether to instantiate the entity before removing. If set,
     *     the entity will be instantiated first to execute mongoose pre/post
     *     remove middleware.
     */
    delete: function(req, res) {
      var alias = req.params.alias
        , id = req.params.id
      var name = util.aliasToName(alias)
      var model = util.modelByName(name)

      // Check if mongoose pre/post remove middleware should be executed.
      if (req.headers['x-remo-mw']) {
        model.findById(id, function(err, document) {
          if (err) {
            util.logIfDebug(err)
            return res.send(500, err)
          }
          document.remove(function(err) {
            if (err) {
              util.logIfDebug(err)
              return res.send(500, err)
            }
            res.send(document)
            var cb = util.resolveCallback(name, 'delete')
            return 'function' === typeof cb ? cb.call(document) : document
          })
        })
      } else {
        model.findByIdAndRemove(id).exec(function(err, model) {
          if (err) {
            util.logIfDebug(err)
            return res.send(500, err)
          }
          res.send(model)
          var cb = util.resolveCallback(name, 'delete')
          return 'function' === typeof cb ? cb.call(model) : model
        })
      }
    },
  }
}
