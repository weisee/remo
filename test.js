var should = require('should')
  , express = require('express')

describe('remo', function() {
  var remo = require('./lib/remo')
    , app = express()

  it('should have "serve" method', function() {
    remo.serve.should.be.a('function')
  })

  describe('#serve()', function() {

    it('should throw an error if no mongoose/mongooseUri options provided', function() {
      (function() {
        remo.serve(app)
      }).should.throwError(/mongoose.*mongooseUri/)
    })

    it('should not throw an error if mongoose/mongooseUri options provided', function() {
      (function() {
        remo.serve(app, {mongooseUri: 'mongodb://localhost/test'})
        remo.serve(app, {mongoose: {}})
      }).should.not.throwError(/mongoose.*mongooseUri/)
    })

    it('should throw an error if "mongooseUri" option isn\'t a string', function() {
      (function() {
        remo.serve(app, {mongooseUri: {}})
      }).should.throwError(/mongooseUri.*string/)
    })

    it('should throw an error if "mongoose" option haven\'t "connection" property', function() {
      (function() {
        remo.serve(app, {mongoose: {}})
      }).should.throwError(/Mongoose instance.*connection/)
    })

    it('should throw an error on mongoose connection error', function() {
      (function() {
        remo.serve(app, {mongooseUri: 'mongodb://nonexisthost/test'})
      }).should.throwError(/Mongoose connection error/)
    })
  })

})
