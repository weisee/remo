Install
=======
`$ npm i remo`

Usage
=====
First of all, you need to define your [Mongoose models](http://mongoosejs.com/docs/models.html).
You don't need to pass them to `remo`, just make it available through `mongoose.model()`.

Then, serve your application
```javascript
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
* `GET http://localhost/api/thing/123` - get `thing` (id = 123)
* `POST http://localhost/api/thing` - create `thing`
* `PUT http://localhost/api/thing/123` - update `thing` (id = 123)
* `DELETE http://localhost/api/thing/123` - delete `thing` (id = 123)

Also
====
You can pass existing mongoose connection rather than open a new one:
```javascript
var mongoose = require('mongoose').connect('mongodb://localhost/test')
remo.serve(app, {mongoose: mongoose})
```

You can enable debug mode by pass `debug: true` option:
```javascript
remo.serve(app, {mongoose: mongoose, debug: true})
```

By default, `remo` converts entity name from URL to "uppercase-first" form, i.e.:

* `mything` -> `Mything`
* `my_thing` -> `My_thing`
* `MyThing` -> `MyThing`

You can pass your own converter in `aliasToName` option, like so:
```javascript
function myAliasToName(alias) {
  return alias.strToUpper()
}
remo.serve(app, {mongoose: mongoose, aliasToName: myAliasToName})

```
