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

  return {
    /**
     * Retrieve an entities list.
     *
     * req.params:
     *   + alias: Entity name
     * req.query:
     *   + where: Search condition
     *   + sort:  Sort expression
     *   + skip:  How much results should be skipped
     *   + limit: Limit value
     */
    list: function(req, res) {
      var alias = req.params.alias
        , query = req.query || {}
      var name = util.aliasToName(alias)
      where = query.where || {}
      if ('undefined' === typeof where._destroy) where._destroy = {$ne: true}
      util.modelByName(name)
        .find(where)
        .populate(query.populate || '')
        .sort(query.sort || {})
        .skip(query.skip || 0)
        .limit(query.limit || {})
        .exec(function(err, models) {
          if (err) {
            util.logIfDebug(err)
            return res.send(500, err)
          }
          return res.send(models)
        })
    },

    /**
     * Retrieve an entity by ID.
     *
     * req.params:
     *   + alias: Entity name
     *   + id:    Entity ID
     */
    get: function(req, res) {
      var alias = req.params.alias
        , id = req.params.id
      var name = util.aliasToName(alias)
      util.modelByName(name)
        .findById(id)
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
      document.save(function(err, model) {
          if (err) {
            util.logIfDebug(err)
            return res.send(500, err)
          }
          return res.send(model)
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
          return res.send(model)
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
      var name = util.aliasToName(alias)
      util.modelByName(name)
        .findByIdAndRemove(id)
        .exec(function(err, model) {
          if (err) {
            util.logIfDebug(err)
            return res.send(500, err)
          }
          return res.send(model)
        })
    },
  }
}
