// ***** BEGIN LICENSE BLOCK *****// ***** BEGIN LICENSE BLOCK *****
// Version: MPL 1.1/GPL 2.0/LGPL 2.1
//
// The contents of this file are subject to the Mozilla Public License Version
// 1.1 (the "License"); you may not use this file except in compliance with
// the License. You may obtain a copy of the License at
// http://www.mozilla.org/MPL/
//
// Software distributed under the License is distributed on an "AS IS" basis,
// WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
// for the specific language governing rights and limitations under the
// License.
//
// The Original Code is Mozilla Corporation Code.
//
// The Initial Developer of the Original Code is
// Mikeal Rogers.
// Portions created by the Initial Developer are Copyright (C) 2008
// the Initial Developer. All Rights Reserved.
//
// Contributor(s):
//  Mikeal Rogers <mikeal.rogers@gmail.com>
//
// Alternatively, the contents of this file may be used under the terms of
// either the GNU General Public License Version 2 or later (the "GPL"), or
// the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
// in which case the provisions of the GPL or the LGPL are applicable instead
// of those above. If you wish to allow use of your version of this file only
// under the terms of either the GPL or the LGPL, and not to allow others to
// use your version of this file under the terms of the MPL, indicate your
// decision by deleting the provisions above and replace them with the notice
// and other provisions required by the GPL or the LGPL. If you do not delete
// the provisions above, a recipient may use your version of this file under
// the terms of any one of the MPL, the GPL or the LGPL.
//
// ***** END LICENSE BLOCK *****

var EXPORTED_SYMBOLS = ['getLength', ];//'compare'];

var getLength = function (obj) {
  var len = 0;
  for (var i in obj) {
    len++;
  }
  return len;
}

// var logging = {}; Components.utils.import('resource://mozmill/stdlib/logging.js', logging);

// var objectsLogger = logging.getLogger('objectsLogger');

// var compare = function (obj1, obj2, depth, recursion) {
//   if (depth == undefined) {
//     var depth = 4;
//   }
//   if (recursion == undefined) {
//     var recursion = 0;
//   }
//
//   if (recursion > depth) {
//     return true;
//   }
//
//   if (typeof(obj1) != typeof(obj2)) {
//     return false;
//   }
//
//   if (typeof(obj1) == "object" && typeof(obj2) == "object") {
//     if ([x for (x in obj1)].length != [x for (x in obj2)].length) {
//       return false;
//     }
//     for (var i in obj1) {
//       recursion++;
//       var result = compare(obj1[i], obj2[i], depth, recursion);
//       objectsLogger.info(i+' in recursion '+result);
//       if (result == false) {
//         return false;
//       }
//     }
//   } else {
//     if (obj1 != obj2) {
//       return false;
//     }
//   }
//   return true;
// }
