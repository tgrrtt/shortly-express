var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,
  // link: function() {
  //   return this.belongsTo(User, 'user_id');
  // },
  initialize: function(){
    // this.on('creating', function(model, attrs, options){

    //   model.set('code', shasum.digest('hex').slice(0, 5));
    // });
  }
});

module.exports = User;
