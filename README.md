Install
=======
`$ npm i remo`

Usage
=====
First of all, you need to define your [Mongoose models](http://mongoosejs.com/docs/models.html).
You don't need to pass them to `remo`, just make them available through `mongoose.model()`.

Then, serve your application:
```js
var express = require('express')
  , models = require('./models') // <- here your models are defined, ok?
  , http = requrie('http')
  , remo = require('remo')
  , app = express()

app.configure(function() {
  // Hold my beer, nginx.
  app.set('port', process.env.PORT || 80)

  // More paths & middleware configuration here.
  // Check any express.js application for details.
})

remo.serve(app, {url: '/api', mongooseUri: 'mongodb://localhost/test'})

http.createServer(app.listen(app.get('port')), function() {
  console.log('He is alive!')
})
```

Done, here's the API:

* `GET http://localhost/api/thing` - list `thing`s
* `GET http://localhost/api/thing/count` - count `thing`s
* `GET http://localhost/api/thing/123` - get `thing` (id = 123)
* `POST http://localhost/api/thing` - create `thing`
* `PUT http://localhost/api/thing/123` - update `thing` (id = 123)
* `DELETE http://localhost/api/thing/123` - delete `thing` (id = 123)

API
===
Remo provides just a single public method [serve](lib/remo.js#L37). Arguments are:

* `app` - Express application instance.
* `_options` - Serving options hash.

Options
-------

* `url` - URL prefix for a REST requests. Defaults to '/remo'.

* `debug` - Debug mode state. Defaults to false.

* `mongoose` - Existing Mongoose connection reference. If empty, the module will try to open connection using `mongooseUri`.

* `mongooseUri` - Mongoose connection URI. Will be ignored if 'mongoose' option is set.

* `countAction` - Url suffix for COUNT action. Defaults to 'count'. Because of using the same URL pattern as for GET action (`/:alias/:id`) the COUNT action may blocks getting an entity with ID = 'count' (kekeke). Override this option with something like '_count' or '__count' (or even '___count'!) if so. Then COUNT url will looks like '/thing/_count'.

* `aliasToName` - By default, remo converts entity name from URL to "uppercase-first" form:

  * mything -> Mything
  * my_thing -> My_thing
  * MyThing -> MyThing

You can pass your own converter in `aliasToName` option, like so:
```js
function myAliasToName(alias) {
  return alias.strToUpper()
}
remo.serve(app, {mongoose: mongoose, aliasToName: myAliasToName})
```

* `callbacks` - A hash of callback functions for actions. Keys of the hash are model names.
Values are hashes with action names as keys and callback functions as values (I don't understand it too). A context of each callback is document instance. Example:

```js
var callbacks = {
  'Thing': {
    'create': function() {
      console.log('Thing #' + this._id + ' created')
    }
  },
  'OtherThing': {
    'update': function() {
      console.log('OtherThing #' + this._id + ' updated')
    }
  },
}
```

Actions
-------

###LIST###

Retrieve an entities list.
URL: `GET /:alias`

```
req.params:
  + alias: Entity name
req.query:
  + find (where,q) : Search condition
  + limit (lim)    : Limit value
  + populate (pop) : Population expression
  + skip           : How much results should be skipped
  + sort           : Sort expression
```


###COUNT###

Retrieve an entities count.
URL: `GET /:alias/count` (Suffix is overrideable, see `options.countAction`)

```
req.params:
  + alias: Entity name
req.query:
  + find (where,q) : Search condition
```


###GET###

Retrieve an entity by ID.
URL: `GET /:alias/:id`

```
req.params:
  + alias: Entity name
  + id:    Entity ID
req.query:
  + populate: Population expression
```


###CREATE###

Create an entity
URL: `POST /:alias`

```
req.params:
  + alias: Entity name
req.body: Attributes hash
```


###UPDATE###

Retrieve an entity by ID.
URL: `PUT /:alias/:id`

```
req.params:
  + alias: Entity name
  + id:    Entity ID
req.body: Attributes hash
```


###DELETE###

Delete an entity by ID.
URL: `PUT /:alias/:id`

```
req.params:
  + alias: Entity name
  + id:    Entity ID
```
