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
  
  /**
   * Checks user access for required action.
   *
   * @param {string} type Request type.
   * @param {mixed} model Entity model.
   * @param {mixed} requestOptions Request options.
   * @param {mixed} req Request object.
   * @param {mixed} res Response object.
   * @return {mixed} Safe request options or sends 403.
   */
  function checkAccess(type, model, requestOptions, req, res, callback) {
    var self = this
    if (typeof callback !== 'function') {
      util.logIfDebug('checkAccess callback must be a function.')
      return res.send(500)
    }
    if (
      !options.accessRules ||
      !options.accessRules[model.modelName] ||
      typeof options.accessRules[model.modelName][type] === 'undefined'
    ) {
      util.logIfDebug(model.modelName + ' have not ' + type + ' access rule.')
      callback.call(self, requestOptions)
    } else {
      var actionAccessRule = options.accessRules[model.modelName][type]
      if (typeof actionAccessRule !== 'function') {
        if (actionAccessRule === '*') {
          callback.call(self, requestOptions)
        } else {
          util.logIfDebug('permission denied.')
          return res.send(403)
        }
      } else {
        actionAccessRule.call(model, req, res, requestOptions, function(allow, checkedOptions){
          if (!allow) {
            util.logIfDebug('permission denied.')
            return res.send(403)
          }
          callback.call(self, checkedOptions ? checkedOptions : requestOptions)
        })
      }
    }
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
        , requestOptions = {
          query: q,
        }
      checkAccess('list', model, requestOptions, req, res, function(safeOptions){
        // Chain query options.
        _.each(safeOptions.query, function(v, k) {
          if (['where', 'q'].indexOf(k) !== -1) k = 'find' // 'find' aliases.
          if (['lim'].indexOf(k) !== -1) k = 'limit' // 'limit' aliases.
          if (['pop'].indexOf(k) !== -1) k = 'populate' // 'populate' aliases.
          if (typeof query[k] === 'function') query = query[k].call(query, v)
          return this
        })
        query = query.find({_destroy: {$ne: true}})
        if (safeOptions.fields) query = query.select(safeOptions.fields)
        // Execute query.
        query.exec(function(err, response) {
          if (err) {
            util.logIfDebug(err)
            return res.send(500, err)
          }
          return res.send(response)
        })
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
      query = query.find({_destroy: {$ne: true}})

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
     *   + populate (pop): Population expression
     */
    get: function(req, res) {
      var alias = req.params.alias
        , id = req.params.id
        , query = req.query || {}
        , name = util.aliasToName(alias)
        , model = util.modelByName(name)
        , requestOptions = {
          query: query,
          id: id,
        }
      checkAccess('get', model, requestOptions, req, res, function(safeOptions){
        var fields = (safeOptions.fields) ? safeOptions.fields : ''
        query = safeOptions.query
        model.findOne({_id: id, _destroy: {$ne: true}}, fields)
          .populate(query.pop || query.populate || '')
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
      })
    },

    /**
     * Create an entity.
     *
     * req.params:
     *   + alias: Entity name
     * req.body: Attributes hash
     * req.query:
     *   + populate (pop): Population expression
     */
    create: function(req, res) {
      var alias = req.params.alias
        , name = util.aliasToName(alias)
        , q = req.query || {}
        , model = util.modelByName(name)
        , requestOptions = {
          query: q,
          attributes: req.body
        }
      checkAccess('create', model, requestOptions, req, res, function(safeOptions){
        var document = new (model)(safeOptions.attributes)
        document.save(function(err, document) {
          if (err) {
            util.logIfDebug(err)
            return res.send(500, err)
          }
          var pop = q.pop || q.populate
          if (pop) {
            document.populate(pop, function(err, document) {
              return res.send(document)
            })
          } else {
            res.send(document)
          }
          var cb = util.resolveCallback(name, 'create')
          return 'function' === typeof cb ? cb.call(document) : document
        })
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
        , name = util.aliasToName(alias)
        , model = util.modelByName(name)  
        , requestOptions = {
          id: id,
          attributes: _.omit(req.body, '_id')
        }
      model.findById(id, function(err, document){
        if (err) {
          util.logIfDebug(err)
          return res.send(500, err)
        }
        requestOptions.document = document
        checkAccess('update', model, requestOptions, req, res, function(safeOptions){
          document.set(safeOptions.attributes)
          document.save(function(err, entity){
            if (err) {
              util.logIfDebug(err)
              return res.send(500, err)
            }
            res.send(entity)
            var cb = util.resolveCallback(name, 'update')
            return 'function' === typeof cb ? cb.call(entity) : entity
          })
        })
      })

    },

    /**
     * Delete an entity.
     *
     * req.params:
     *   + alias: Entity name
     *   + id:    Entity ID
     */
    delete: function(req, res) {
      var alias = req.params.alias
        , id = req.params.id
        , name = util.aliasToName(alias)
        , model = util.modelByName(name)
        , requestOptions = {
          id: id
        }
      model.findById(requestOptions.id, function(err, document) {
        if (err) {
          util.logIfDebug(err)
          return res.send(500, err)
        }
        requestOptions.document = document
        checkAccess('delete', model, requestOptions, req, res, function(safeOptions){
          safeOptions.document.remove(function(err) {
            if (err) {
              util.logIfDebug(err)
              return res.send(500, err)
            }
            res.send(safeOptions.document)
            var cb = util.resolveCallback(name, 'delete')
            return 'function' === typeof cb ? cb.call(safeOptions.document) : safeOptions.document
          })
        })
      })
    },
  }
}
