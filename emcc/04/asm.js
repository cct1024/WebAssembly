// include: shell.js
// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(moduleArg) => Promise<Module>
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module != "undefined" ? Module : {};

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).
// Attempt to auto-detect the environment
var ENVIRONMENT_IS_WEB = typeof window == "object";

var ENVIRONMENT_IS_WORKER = typeof WorkerGlobalScope != "undefined";

// N.b. Electron.js environment is simultaneously a NODE-environment, but
// also a web environment.
var ENVIRONMENT_IS_NODE = typeof process == "object" && typeof process.versions == "object" && typeof process.versions.node == "string" && process.type != "renderer";

var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (ENVIRONMENT_IS_NODE) {}

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = Object.assign({}, Module);

var arguments_ = [];

var thisProgram = "./this.program";

var quit_ = (status, toThrow) => {
  throw toThrow;
};

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = "";

function locateFile(path) {
  if (Module["locateFile"]) {
    return Module["locateFile"](path, scriptDirectory);
  }
  return scriptDirectory + path;
}

// Hooks that are implemented differently in different runtime environments.
var readAsync, readBinary;

if (ENVIRONMENT_IS_NODE) {
  if (typeof process == "undefined" || !process.release || process.release.name !== "node") throw new Error("not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)");
  var nodeVersion = process.versions.node;
  var numericVersion = nodeVersion.split(".").slice(0, 3);
  numericVersion = (numericVersion[0] * 1e4) + (numericVersion[1] * 100) + (numericVersion[2].split("-")[0] * 1);
  var minVersion = 16e4;
  if (numericVersion < 16e4) {
    throw new Error("This emscripten-generated code requires node v16.0.0 (detected v" + nodeVersion + ")");
  }
  // These modules will usually be used on Node.js. Load them eagerly to avoid
  // the complexity of lazy-loading.
  var fs = require("fs");
  var nodePath = require("path");
  scriptDirectory = __dirname + "/";
  // include: node_shell_read.js
  readBinary = filename => {
    // We need to re-wrap `file://` strings to URLs.
    filename = isFileURI(filename) ? new URL(filename) : filename;
    var ret = fs.readFileSync(filename);
    assert(Buffer.isBuffer(ret));
    return ret;
  };
  readAsync = async (filename, binary = true) => {
    // See the comment in the `readBinary` function.
    filename = isFileURI(filename) ? new URL(filename) : filename;
    var ret = fs.readFileSync(filename, binary ? undefined : "utf8");
    assert(binary ? Buffer.isBuffer(ret) : typeof ret == "string");
    return ret;
  };
  // end include: node_shell_read.js
  if (!Module["thisProgram"] && process.argv.length > 1) {
    thisProgram = process.argv[1].replace(/\\/g, "/");
  }
  arguments_ = process.argv.slice(2);
  if (typeof module != "undefined") {
    module["exports"] = Module;
  }
  quit_ = (status, toThrow) => {
    process.exitCode = status;
    throw toThrow;
  };
} else if (ENVIRONMENT_IS_SHELL) {
  if ((typeof process == "object" && typeof require === "function") || typeof window == "object" || typeof WorkerGlobalScope != "undefined") throw new Error("not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)");
} else // Note that this includes Node.js workers when relevant (pthreads is enabled).
// Node.js workers are detected as a combination of ENVIRONMENT_IS_WORKER and
// ENVIRONMENT_IS_NODE.
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  if (ENVIRONMENT_IS_WORKER) {
    // Check worker, not web, since window could be polyfilled
    scriptDirectory = self.location.href;
  } else if (typeof document != "undefined" && document.currentScript) {
    // web
    scriptDirectory = document.currentScript.src;
  }
  // blob urls look like blob:http://site.com/etc/etc and we cannot infer anything from them.
  // otherwise, slice off the final part of the url to find the script directory.
  // if scriptDirectory does not contain a slash, lastIndexOf will return -1,
  // and scriptDirectory will correctly be replaced with an empty string.
  // If scriptDirectory contains a query (starting with ?) or a fragment (starting with #),
  // they are removed because they could contain a slash.
  if (scriptDirectory.startsWith("blob:")) {
    scriptDirectory = "";
  } else {
    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1);
  }
  if (!(typeof window == "object" || typeof WorkerGlobalScope != "undefined")) throw new Error("not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)");
  {
    // include: web_or_worker_shell_read.js
    if (ENVIRONMENT_IS_WORKER) {
      readBinary = url => {
        var xhr = new XMLHttpRequest;
        xhr.open("GET", url, false);
        xhr.responseType = "arraybuffer";
        xhr.send(null);
        return new Uint8Array(/** @type{!ArrayBuffer} */ (xhr.response));
      };
    }
    readAsync = async url => {
      // Fetch has some additional restrictions over XHR, like it can't be used on a file:// url.
      // See https://github.com/github/fetch/pull/92#issuecomment-140665932
      // Cordova or Electron apps are typically loaded from a file:// url.
      // So use XHR on webview if URL is a file URL.
      if (isFileURI(url)) {
        return new Promise((resolve, reject) => {
          var xhr = new XMLHttpRequest;
          xhr.open("GET", url, true);
          xhr.responseType = "arraybuffer";
          xhr.onload = () => {
            if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
              // file URLs can return 0
              resolve(xhr.response);
              return;
            }
            reject(xhr.status);
          };
          xhr.onerror = reject;
          xhr.send(null);
        });
      }
      var response = await fetch(url, {
        credentials: "same-origin"
      });
      if (response.ok) {
        return response.arrayBuffer();
      }
      throw new Error(response.status + " : " + response.url);
    };
  }
} else // end include: web_or_worker_shell_read.js
{
  throw new Error("environment detection error");
}

var out = Module["print"] || console.log.bind(console);

var err = Module["printErr"] || console.error.bind(console);

// Merge back in the overrides
Object.assign(Module, moduleOverrides);

// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used.
moduleOverrides = null;

checkIncomingModuleAPI();

// Emit code to handle expected values on the Module object. This applies Module.x
// to the proper local x. This has two benefits: first, we only emit it if it is
// expected to arrive, and second, by using a local everywhere else that can be
// minified.
if (Module["arguments"]) arguments_ = Module["arguments"];

legacyModuleProp("arguments", "arguments_");

if (Module["thisProgram"]) thisProgram = Module["thisProgram"];

legacyModuleProp("thisProgram", "thisProgram");

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
// Assertions on removed incoming Module JS APIs.
assert(typeof Module["memoryInitializerPrefixURL"] == "undefined", "Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead");

assert(typeof Module["pthreadMainPrefixURL"] == "undefined", "Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead");

assert(typeof Module["cdInitializerPrefixURL"] == "undefined", "Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead");

assert(typeof Module["filePackagePrefixURL"] == "undefined", "Module.filePackagePrefixURL option was removed, use Module.locateFile instead");

assert(typeof Module["read"] == "undefined", "Module.read option was removed");

assert(typeof Module["readAsync"] == "undefined", "Module.readAsync option was removed (modify readAsync in JS)");

assert(typeof Module["readBinary"] == "undefined", "Module.readBinary option was removed (modify readBinary in JS)");

assert(typeof Module["setWindowTitle"] == "undefined", "Module.setWindowTitle option was removed (modify emscripten_set_window_title in JS)");

assert(typeof Module["TOTAL_MEMORY"] == "undefined", "Module.TOTAL_MEMORY has been renamed Module.INITIAL_MEMORY");

legacyModuleProp("asm", "wasmExports");

legacyModuleProp("readAsync", "readAsync");

legacyModuleProp("readBinary", "readBinary");

legacyModuleProp("setWindowTitle", "setWindowTitle");

var IDBFS = "IDBFS is no longer included by default; build with -lidbfs.js";

var PROXYFS = "PROXYFS is no longer included by default; build with -lproxyfs.js";

var WORKERFS = "WORKERFS is no longer included by default; build with -lworkerfs.js";

var FETCHFS = "FETCHFS is no longer included by default; build with -lfetchfs.js";

var ICASEFS = "ICASEFS is no longer included by default; build with -licasefs.js";

var JSFILEFS = "JSFILEFS is no longer included by default; build with -ljsfilefs.js";

var OPFS = "OPFS is no longer included by default; build with -lopfs.js";

var NODEFS = "NODEFS is no longer included by default; build with -lnodefs.js";

assert(!ENVIRONMENT_IS_SHELL, "shell environment detected but not enabled at build time.  Add `shell` to `-sENVIRONMENT` to enable.");

// end include: shell.js
// include: preamble.js
// === Preamble library stuff ===
// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html
var wasmBinary = Module["wasmBinary"];

legacyModuleProp("wasmBinary", "wasmBinary");

// include: wasm2js.js
// wasm2js.js - enough of a polyfill for the WebAssembly object so that we can load
// wasm2js code that way.
// Emit "var WebAssembly" if definitely using wasm2js. Otherwise, in MAYBE_WASM2JS
// mode, we can't use a "var" since it would prevent normal wasm from working.
/** @suppress{duplicate, const} */ var WebAssembly = {
  // Note that we do not use closure quoting (this['buffer'], etc.) on these
  // functions, as they are just meant for internal use. In other words, this is
  // not a fully general polyfill.
  /** @constructor */ Memory: function(opts) {
    this.buffer = new ArrayBuffer(opts["initial"] * 65536);
  },
  Module: function(binary) {},
  /** @constructor */ Instance: function(module, info) {
    // TODO: use the module somehow - right now the wasm2js output is embedded in
    // the main JS
    // This will be replaced by the actual wasm2js code.
    this.exports = (
function instantiate(info) {
function Table(ret) {
  // grow method not included; table is not growable
  ret.set = function(i, func) {
    this[i] = func;
  };
  ret.get = function(i) {
    return this[i];
  };
  return ret;
}

  var bufferView;
  var base64ReverseLookup = new Uint8Array(123/*'z'+1*/);
  for (var i = 25; i >= 0; --i) {
    base64ReverseLookup[48+i] = 52+i; // '0-9'
    base64ReverseLookup[65+i] = i; // 'A-Z'
    base64ReverseLookup[97+i] = 26+i; // 'a-z'
  }
  base64ReverseLookup[43] = 62; // '+'
  base64ReverseLookup[47] = 63; // '/'
  /** @noinline Inlining this function would mean expanding the base64 string 4x times in the source code, which Closure seems to be happy to do. */
  function base64DecodeToExistingUint8Array(uint8Array, offset, b64) {
    var b1, b2, i = 0, j = offset, bLength = b64.length, end = offset + (bLength*3>>2) - (b64[bLength-2] == '=') - (b64[bLength-1] == '=');
    for (; i < bLength; i += 4) {
      b1 = base64ReverseLookup[b64.charCodeAt(i+1)];
      b2 = base64ReverseLookup[b64.charCodeAt(i+2)];
      uint8Array[j++] = base64ReverseLookup[b64.charCodeAt(i)] << 2 | b1 >> 4;
      if (j < end) uint8Array[j++] = b1 << 4 | b2 >> 2;
      if (j < end) uint8Array[j++] = b2 << 6 | base64ReverseLookup[b64.charCodeAt(i+3)];
    }
  }
function initActiveSegments(imports) {
  base64DecodeToExistingUint8Array(bufferView, 65536, "LSsgICAwWDB4AC0wWCswWCAwWC0weCsweCAweABuYW4AaW5mAE5BTgBJTkYALgAobnVsbCkAY1swXTolZCxjWzFdOiVkLGNbMl06JWQsY1szXTolZCxmOiVmCgAAAAAAGQALABkZGQAAAAAFAAAAAAAACQAAAAALAAAAAAAAAAAZAAoKGRkZAwoHAAEACQsYAAAJBgsAAAsABhkAAAAZGRkAAAAAAAAAAAAAAAAAAAAADgAAAAAAAAAAGQALDRkZGQANAAACAAkOAAAACQAOAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAABMAAAAAEwAAAAAJDAAAAAAADAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAPAAAABA8AAAAACRAAAAAAABAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEgAAAAAAAAAAAAAAEQAAAAARAAAAAAkSAAAAAAASAAASAAAaAAAAGhoaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABoAAAAaGhoAAAAAAAAJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUAAAAAAAAAAAAAAAXAAAAABcAAAAACRQAAAAAABQAABQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFgAAAAAAAAAAAAAAFQAAAAAVAAAAAAkWAAAAAAAWAAAWAAAwMTIzNDU2Nzg5QUJDREVGTm8gZXJyb3IgaW5mb3JtYXRpb24ASWxsZWdhbCBieXRlIHNlcXVlbmNlAERvbWFpbiBlcnJvcgBSZXN1bHQgbm90IHJlcHJlc2VudGFibGUATm90IGEgdHR5AFBlcm1pc3Npb24gZGVuaWVkAE9wZXJhdGlvbiBub3QgcGVybWl0dGVkAE5vIHN1Y2ggZmlsZSBvciBkaXJlY3RvcnkATm8gc3VjaCBwcm9jZXNzAEZpbGUgZXhpc3RzAFZhbHVlIHRvbyBsYXJnZSBmb3IgZGF0YSB0eXBlAE5vIHNwYWNlIGxlZnQgb24gZGV2aWNlAE91dCBvZiBtZW1vcnkAUmVzb3VyY2UgYnVzeQBJbnRlcnJ1cHRlZCBzeXN0ZW0gY2FsbABSZXNvdXJjZSB0ZW1wb3JhcmlseSB1bmF2YWlsYWJsZQBJbnZhbGlkIHNlZWsAQ3Jvc3MtZGV2aWNlIGxpbmsAUmVhZC1vbmx5IGZpbGUgc3lzdGVtAERpcmVjdG9yeSBub3QgZW1wdHkAQ29ubmVjdGlvbiByZXNldCBieSBwZWVyAE9wZXJhdGlvbiB0aW1lZCBvdXQAQ29ubmVjdGlvbiByZWZ1c2VkAEhvc3QgaXMgZG93bgBIb3N0IGlzIHVucmVhY2hhYmxlAEFkZHJlc3MgaW4gdXNlAEJyb2tlbiBwaXBlAEkvTyBlcnJvcgBObyBzdWNoIGRldmljZSBvciBhZGRyZXNzAEJsb2NrIGRldmljZSByZXF1aXJlZABObyBzdWNoIGRldmljZQBOb3QgYSBkaXJlY3RvcnkASXMgYSBkaXJlY3RvcnkAVGV4dCBmaWxlIGJ1c3kARXhlYyBmb3JtYXQgZXJyb3IASW52YWxpZCBhcmd1bWVudABBcmd1bWVudCBsaXN0IHRvbyBsb25nAFN5bWJvbGljIGxpbmsgbG9vcABGaWxlbmFtZSB0b28gbG9uZwBUb28gbWFueSBvcGVuIGZpbGVzIGluIHN5c3RlbQBObyBmaWxlIGRlc2NyaXB0b3JzIGF2YWlsYWJsZQBCYWQgZmlsZSBkZXNjcmlwdG9yAE5vIGNoaWxkIHByb2Nlc3MAQmFkIGFkZHJlc3MARmlsZSB0b28gbGFyZ2UAVG9vIG1hbnkgbGlua3MATm8gbG9ja3MgYXZhaWxhYmxlAFJlc291cmNlIGRlYWRsb2NrIHdvdWxkIG9jY3VyAFN0YXRlIG5vdCByZWNvdmVyYWJsZQBQcmV2aW91cyBvd25lciBkaWVkAE9wZXJhdGlvbiBjYW5jZWxlZABGdW5jdGlvbiBub3QgaW1wbGVtZW50ZWQATm8gbWVzc2FnZSBvZiBkZXNpcmVkIHR5cGUASWRlbnRpZmllciByZW1vdmVkAERldmljZSBub3QgYSBzdHJlYW0ATm8gZGF0YSBhdmFpbGFibGUARGV2aWNlIHRpbWVvdXQAT3V0IG9mIHN0cmVhbXMgcmVzb3VyY2VzAExpbmsgaGFzIGJlZW4gc2V2ZXJlZABQcm90b2NvbCBlcnJvcgBCYWQgbWVzc2FnZQBGaWxlIGRlc2NyaXB0b3IgaW4gYmFkIHN0YXRlAE5vdCBhIHNvY2tldABEZXN0aW5hdGlvbiBhZGRyZXNzIHJlcXVpcmVkAE1lc3NhZ2UgdG9vIGxhcmdlAFByb3RvY29sIHdyb25nIHR5cGUgZm9yIHNvY2tldABQcm90b2NvbCBub3QgYXZhaWxhYmxlAFByb3RvY29sIG5vdCBzdXBwb3J0ZWQAU29ja2V0IHR5cGUgbm90IHN1cHBvcnRlZABOb3Qgc3VwcG9ydGVkAFByb3RvY29sIGZhbWlseSBub3Qgc3VwcG9ydGVkAEFkZHJlc3MgZmFtaWx5IG5vdCBzdXBwb3J0ZWQgYnkgcHJvdG9jb2wAQWRkcmVzcyBub3QgYXZhaWxhYmxlAE5ldHdvcmsgaXMgZG93bgBOZXR3b3JrIHVucmVhY2hhYmxlAENvbm5lY3Rpb24gcmVzZXQgYnkgbmV0d29yawBDb25uZWN0aW9uIGFib3J0ZWQATm8gYnVmZmVyIHNwYWNlIGF2YWlsYWJsZQBTb2NrZXQgaXMgY29ubmVjdGVkAFNvY2tldCBub3QgY29ubmVjdGVkAENhbm5vdCBzZW5kIGFmdGVyIHNvY2tldCBzaHV0ZG93bgBPcGVyYXRpb24gYWxyZWFkeSBpbiBwcm9ncmVzcwBPcGVyYXRpb24gaW4gcHJvZ3Jlc3MAU3RhbGUgZmlsZSBoYW5kbGUAUmVtb3RlIEkvTyBlcnJvcgBRdW90YSBleGNlZWRlZABObyBtZWRpdW0gZm91bmQAV3JvbmcgbWVkaXVtIHR5cGUATXVsdGlob3AgYXR0ZW1wdGVkAFJlcXVpcmVkIGtleSBub3QgYXZhaWxhYmxlAEtleSBoYXMgZXhwaXJlZABLZXkgaGFzIGJlZW4gcmV2b2tlZABLZXkgd2FzIHJlamVjdGVkIGJ5IHNlcnZpY2UAAAAAAAAAAAClAlsA8AG1BYwFJQGDBh0DlAT/AMcDMQMLBrwBjwF/A8oEKwDaBq8AQgNOA9wBDgQVAKEGDQGUAgsCOAZkArwC/wJdA+cECwfPAssF7wXbBeECHgZFAoUAggJsA28E8QDzAxgF2QDaA0wGVAJ7AZ0DvQQAAFEAFQK7ALMDbQD/AYUELwX5BDgAZQFGAZ8AtwaoAXMCUwEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAhBAAAAAAAAAAALwIAAAAAAAAAAAAAAAAAAAAAAAAAADUERwRWBAAAAAAAAAAAAAAAAAAAAACgBAAAAAAAAAAAAAAAAAAAAAAAAEYFYAVuBWEGAADPAQAAAAAAAAAAyQbpBvkGHgc5B0kHXgc=");
  base64DecodeToExistingUint8Array(bufferView, 68344, "BQAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAMAAACYCwEAAAQAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAP////8KAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA+AoBAGASAQA=");
}

  var scratchBuffer = new ArrayBuffer(16);
  var i32ScratchView = new Int32Array(scratchBuffer);
  var f32ScratchView = new Float32Array(scratchBuffer);
  var f64ScratchView = new Float64Array(scratchBuffer);
  
  function wasm2js_scratch_load_i32(index) {
    return i32ScratchView[index];
  }
      
  function wasm2js_scratch_store_i32(index, value) {
    i32ScratchView[index] = value;
  }
      
  function wasm2js_scratch_load_f64() {
    return f64ScratchView[0];
  }
      
  function wasm2js_scratch_store_f64(value) {
    f64ScratchView[0] = value;
  }
      function wasm2js_trap() { throw new Error('abort'); }

function asmFunc(imports) {
 var buffer = new ArrayBuffer(16908288);
 var HEAP8 = new Int8Array(buffer);
 var HEAP16 = new Int16Array(buffer);
 var HEAP32 = new Int32Array(buffer);
 var HEAPU8 = new Uint8Array(buffer);
 var HEAPU16 = new Uint16Array(buffer);
 var HEAPU32 = new Uint32Array(buffer);
 var HEAPF32 = new Float32Array(buffer);
 var HEAPF64 = new Float64Array(buffer);
 var Math_imul = Math.imul;
 var Math_fround = Math.fround;
 var Math_abs = Math.abs;
 var Math_clz32 = Math.clz32;
 var Math_min = Math.min;
 var Math_max = Math.max;
 var Math_floor = Math.floor;
 var Math_ceil = Math.ceil;
 var Math_trunc = Math.trunc;
 var Math_sqrt = Math.sqrt;
 var wasi_snapshot_preview1 = imports.wasi_snapshot_preview1;
 var fimport$0 = wasi_snapshot_preview1.fd_write;
 var env = imports.env;
 var fimport$1 = env._emscripten_memcpy_js;
 var fimport$2 = env.emscripten_resize_heap;
 var fimport$3 = env.segfault;
 var fimport$4 = env.alignfault;
 var global$0 = 65536;
 var global$1 = 0;
 var global$2 = 0;
 var global$3 = 0;
 var __wasm_intrinsics_temp_i64 = 0;
 var __wasm_intrinsics_temp_i64$hi = 0;
 var i64toi32_i32$HIGH_BITS = 0;
 // EMSCRIPTEN_START_FUNCS
;
 function $0() {
  $52();
  $38();
 }
 
 function $1() {
  var $2_1 = 0, $16_1 = 0, $10_1 = 0, $17_1 = 0, $18_1 = 0, $19_1 = 0, $20_1 = 0, $106 = 0;
  $2_1 = global$0 - 48 | 0;
  global$0 = $2_1;
  $101($2_1 | 0, 44 | 0, 0 | 0);
  $101($2_1 | 0, 40 | 0, $41(100 | 0) | 0 | 0);
  $101($2_1 | 0, 36 | 0, ($72($2_1 | 0, 40 | 0) | 0) + 2 | 0 | 0);
  $10_1 = 123;
  $96($72($2_1 | 0, 36 | 0) | 0 | 0, 3 | 0, $10_1 | 0);
  $96($72($2_1 | 0, 36 | 0) | 0 | 0, 2 | 0, $10_1 | 0);
  $96($72($2_1 | 0, 36 | 0) | 0 | 0, 1 | 0, $10_1 | 0);
  $96($72($2_1 | 0, 36 | 0) | 0 | 0, 0 | 0, $10_1 | 0);
  $101($72($2_1 | 0, 36 | 0) | 0 | 0, 4 | 0, 1078523331 | 0);
  $16_1 = $72($2_1 | 0, 36 | 0) | 0;
  $17_1 = $65($16_1 | 0, 0 | 0) | 0;
  $18_1 = $65($16_1 | 0, 1 | 0) | 0;
  $19_1 = $65($16_1 | 0, 2 | 0) | 0;
  $20_1 = $65($16_1 | 0, 3 | 0) | 0;
  $118($2_1 + 16 | 0 | 0, 0 | 0, +(+Math_fround($91($16_1 | 0, 4 | 0))));
  $101($2_1 | 0, 12 | 0, $20_1 | 0);
  $101($2_1 | 0, 8 | 0, $19_1 | 0);
  $101($2_1 | 0, 4 | 0, $18_1 | 0);
  $101($2_1 | 0, 0 | 0, $17_1 | 0);
  $3(65590 | 0, $2_1 | 0) | 0;
  $43($72($2_1 | 0, 40 | 0) | 0 | 0);
  global$0 = $2_1 + 48 | 0;
  return 0 | 0;
 }
 
 function $2($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $5_1 = 0;
  return $1() | 0 | 0;
 }
 
 function $3($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = global$0 - 16 | 0;
  global$0 = $2_1;
  $101($2_1 | 0, 12 | 0, $1_1 | 0);
  $1_1 = $30(68344 | 0, $0_1 | 0, $1_1 | 0) | 0;
  global$0 = $2_1 + 16 | 0;
  return $1_1 | 0;
 }
 
 function $4($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $4_1 = 0, $3_1 = 0, $5_1 = 0, $8_1 = 0, $6_1 = 0, $7_1 = 0, $9_1 = 0;
  $3_1 = global$0 - 32 | 0;
  global$0 = $3_1;
  $4_1 = $72($0_1 | 0, 28 | 0) | 0;
  $101($3_1 | 0, 16 | 0, $4_1 | 0);
  $5_1 = $72($0_1 | 0, 20 | 0) | 0;
  $101($3_1 | 0, 28 | 0, $2_1 | 0);
  $101($3_1 | 0, 24 | 0, $1_1 | 0);
  $1_1 = $5_1 - $4_1 | 0;
  $101($3_1 | 0, 20 | 0, $1_1 | 0);
  $6_1 = $1_1 + $2_1 | 0;
  $4_1 = $3_1 + 16 | 0;
  $7_1 = 2;
  block5 : {
   block4 : {
    block2 : {
     block1 : {
      block : {
       if (!($34(fimport$0($72($0_1 | 0, 60 | 0) | 0 | 0, $3_1 + 16 | 0 | 0, 2 | 0, $3_1 + 12 | 0 | 0) | 0 | 0) | 0)) {
        break block
       }
       $5_1 = $4_1;
       break block1;
      }
      label : while (1) {
       $1_1 = $72($3_1 | 0, 12 | 0) | 0;
       if (($6_1 | 0) == ($1_1 | 0)) {
        break block2
       }
       block3 : {
        if (($1_1 | 0) > (-1 | 0)) {
         break block3
        }
        $5_1 = $4_1;
        break block4;
       }
       $8_1 = $72($4_1 | 0, 4 | 0) | 0;
       $9_1 = $1_1 >>> 0 > $8_1 >>> 0;
       $5_1 = $4_1 + ($9_1 << 3 | 0) | 0;
       $8_1 = $1_1 - ($9_1 ? $8_1 : 0) | 0;
       $101($5_1 | 0, 0 | 0, ($72($5_1 | 0, 0 | 0) | 0) + $8_1 | 0 | 0);
       $4_1 = $4_1 + ($9_1 ? 12 : 4) | 0;
       $101($4_1 | 0, 0 | 0, ($72($4_1 | 0, 0 | 0) | 0) - $8_1 | 0 | 0);
       $6_1 = $6_1 - $1_1 | 0;
       $4_1 = $5_1;
       $7_1 = $7_1 - $9_1 | 0;
       if (!($34(fimport$0($72($0_1 | 0, 60 | 0) | 0 | 0, $4_1 | 0, $7_1 | 0, $3_1 + 12 | 0 | 0) | 0 | 0) | 0)) {
        continue label
       }
       break label;
      };
     }
     if (($6_1 | 0) != (-1 | 0)) {
      break block4
     }
    }
    $1_1 = $72($0_1 | 0, 44 | 0) | 0;
    $101($0_1 | 0, 28 | 0, $1_1 | 0);
    $101($0_1 | 0, 20 | 0, $1_1 | 0);
    $101($0_1 | 0, 16 | 0, $1_1 + ($72($0_1 | 0, 48 | 0) | 0) | 0 | 0);
    $1_1 = $2_1;
    break block5;
   }
   $1_1 = 0;
   $101($0_1 | 0, 28 | 0, 0 | 0);
   $111($0_1 | 0, 16 | 0, 0 | 0, 0 | 0);
   $101($0_1 | 0, 0 | 0, $72($0_1 | 0, 0 | 0) | 0 | 32 | 0 | 0);
   if (($7_1 | 0) == (2 | 0)) {
    break block5
   }
   $1_1 = $2_1 - ($72($5_1 | 0, 4 | 0) | 0) | 0;
  }
  global$0 = $3_1 + 32 | 0;
  return $1_1 | 0;
 }
 
 function $5($0_1) {
  $0_1 = $0_1 | 0;
  return 0 | 0;
 }
 
 function $6($0_1, $1_1, $1$hi, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  i64toi32_i32$HIGH_BITS = 0;
  return 0 | 0;
 }
 
 function $7($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, i64toi32_i32$0 = 0, $4_1 = 0, $6_1 = 0, i64toi32_i32$1 = 0, $5_1 = 0, $6$hi = 0;
  block : {
   if (!$2_1) {
    break block
   }
   $96($0_1 | 0, 0 | 0, $1_1 | 0);
   $3_1 = $0_1 + $2_1 | 0;
   $96($3_1 + -1 | 0 | 0, 0 | 0, $1_1 | 0);
   if ($2_1 >>> 0 < 3 >>> 0) {
    break block
   }
   $96($0_1 | 0, 2 | 0, $1_1 | 0);
   $96($0_1 | 0, 1 | 0, $1_1 | 0);
   $96($3_1 + -3 | 0 | 0, 0 | 0, $1_1 | 0);
   $96($3_1 + -2 | 0 | 0, 0 | 0, $1_1 | 0);
   if ($2_1 >>> 0 < 7 >>> 0) {
    break block
   }
   $96($0_1 | 0, 3 | 0, $1_1 | 0);
   $96($3_1 + -4 | 0 | 0, 0 | 0, $1_1 | 0);
   if ($2_1 >>> 0 < 9 >>> 0) {
    break block
   }
   $4_1 = (0 - $0_1 | 0) & 3 | 0;
   $3_1 = $0_1 + $4_1 | 0;
   $1_1 = Math_imul($1_1 & 255 | 0, 16843009);
   $101($3_1 | 0, 0 | 0, $1_1 | 0);
   $4_1 = ($2_1 - $4_1 | 0) & -4 | 0;
   $2_1 = $3_1 + $4_1 | 0;
   $101($2_1 + -4 | 0 | 0, 0 | 0, $1_1 | 0);
   if ($4_1 >>> 0 < 9 >>> 0) {
    break block
   }
   $101($3_1 | 0, 8 | 0, $1_1 | 0);
   $101($3_1 | 0, 4 | 0, $1_1 | 0);
   $101($2_1 + -8 | 0 | 0, 0 | 0, $1_1 | 0);
   $101($2_1 + -12 | 0 | 0, 0 | 0, $1_1 | 0);
   if ($4_1 >>> 0 < 25 >>> 0) {
    break block
   }
   $101($3_1 | 0, 24 | 0, $1_1 | 0);
   $101($3_1 | 0, 20 | 0, $1_1 | 0);
   $101($3_1 | 0, 16 | 0, $1_1 | 0);
   $101($3_1 | 0, 12 | 0, $1_1 | 0);
   $101($2_1 + -16 | 0 | 0, 0 | 0, $1_1 | 0);
   $101($2_1 + -20 | 0 | 0, 0 | 0, $1_1 | 0);
   $101($2_1 + -24 | 0 | 0, 0 | 0, $1_1 | 0);
   $101($2_1 + -28 | 0 | 0, 0 | 0, $1_1 | 0);
   $5_1 = $3_1 & 4 | 0 | 24 | 0;
   $2_1 = $4_1 - $5_1 | 0;
   if ($2_1 >>> 0 < 32 >>> 0) {
    break block
   }
   i64toi32_i32$0 = 0;
   i64toi32_i32$1 = 1;
   i64toi32_i32$1 = __wasm_i64_mul($1_1 | 0, i64toi32_i32$0 | 0, 1 | 0, i64toi32_i32$1 | 0) | 0;
   i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
   $6_1 = i64toi32_i32$1;
   $6$hi = i64toi32_i32$0;
   $1_1 = $3_1 + $5_1 | 0;
   label : while (1) {
    i64toi32_i32$0 = $6$hi;
    $111($1_1 | 0, 24 | 0, $6_1 | 0, i64toi32_i32$0 | 0);
    $111($1_1 | 0, 16 | 0, $6_1 | 0, i64toi32_i32$0 | 0);
    $111($1_1 | 0, 8 | 0, $6_1 | 0, i64toi32_i32$0 | 0);
    $111($1_1 | 0, 0 | 0, $6_1 | 0, i64toi32_i32$0 | 0);
    $1_1 = $1_1 + 32 | 0;
    $2_1 = $2_1 + -32 | 0;
    if ($2_1 >>> 0 > 31 >>> 0) {
     continue label
    }
    break label;
   };
  }
  return $0_1 | 0;
 }
 
 function $8($0_1) {
  $0_1 = $0_1 | 0;
  return 1 | 0;
 }
 
 function $9($0_1) {
  $0_1 = $0_1 | 0;
 }
 
 function $10($0_1) {
  $0_1 = $0_1 | 0;
 }
 
 function $11($0_1) {
  $0_1 = $0_1 | 0;
 }
 
 function $12() {
  $10(69528 | 0);
  return 69532 | 0;
 }
 
 function $13() {
  $11(69528 | 0);
 }
 
 function $14($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  $1_1 = $72($0_1 | 0, 72 | 0) | 0;
  $101($0_1 | 0, 72 | 0, $1_1 + -1 | 0 | $1_1 | 0 | 0);
  block : {
   $1_1 = $72($0_1 | 0, 0 | 0) | 0;
   if (!($1_1 & 8 | 0)) {
    break block
   }
   $101($0_1 | 0, 0 | 0, $1_1 | 32 | 0 | 0);
   return -1 | 0;
  }
  $110($0_1 | 0, 4 | 0, 0 | 0, 0 | 0);
  $1_1 = $72($0_1 | 0, 44 | 0) | 0;
  $101($0_1 | 0, 28 | 0, $1_1 | 0);
  $101($0_1 | 0, 20 | 0, $1_1 | 0);
  $101($0_1 | 0, 16 | 0, $1_1 + ($72($0_1 | 0, 48 | 0) | 0) | 0 | 0);
  return 0 | 0;
 }
 
 function $15($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0;
  $3_1 = ($2_1 | 0) != (0 | 0);
  block2 : {
   block1 : {
    block : {
     if (!($0_1 & 3 | 0)) {
      break block
     }
     if (!$2_1) {
      break block
     }
     $4_1 = $1_1 & 255 | 0;
     label : while (1) {
      if (($65($0_1 | 0, 0 | 0) | 0 | 0) == ($4_1 | 0)) {
       break block1
      }
      $2_1 = $2_1 + -1 | 0;
      $3_1 = ($2_1 | 0) != (0 | 0);
      $0_1 = $0_1 + 1 | 0;
      if (!($0_1 & 3 | 0)) {
       break block
      }
      if ($2_1) {
       continue label
      }
      break label;
     };
    }
    if (!$3_1) {
     break block2
    }
    block3 : {
     if (($65($0_1 | 0, 0 | 0) | 0 | 0) == ($1_1 & 255 | 0 | 0)) {
      break block3
     }
     if ($2_1 >>> 0 < 4 >>> 0) {
      break block3
     }
     $4_1 = Math_imul($1_1 & 255 | 0, 16843009);
     label1 : while (1) {
      $3_1 = ($72($0_1 | 0, 0 | 0) | 0) ^ $4_1 | 0;
      if (((16843008 - $3_1 | 0 | $3_1 | 0) & -2139062144 | 0 | 0) != (-2139062144 | 0)) {
       break block1
      }
      $0_1 = $0_1 + 4 | 0;
      $2_1 = $2_1 + -4 | 0;
      if ($2_1 >>> 0 > 3 >>> 0) {
       continue label1
      }
      break label1;
     };
    }
    if (!$2_1) {
     break block2
    }
   }
   $3_1 = $1_1 & 255 | 0;
   label2 : while (1) {
    block4 : {
     if (($65($0_1 | 0, 0 | 0) | 0 | 0) != ($3_1 | 0)) {
      break block4
     }
     return $0_1 | 0;
    }
    $0_1 = $0_1 + 1 | 0;
    $2_1 = $2_1 + -1 | 0;
    if ($2_1) {
     continue label2
    }
    break label2;
   };
  }
  return 0 | 0;
 }
 
 function $16($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = $15($0_1 | 0, 0 | 0, $1_1 | 0) | 0;
  return ($2_1 ? $2_1 - $0_1 | 0 : $1_1) | 0;
 }
 
 function $17() {
  return 69540 | 0;
 }
 
 function $18($0_1, $1_1) {
  $0_1 = +$0_1;
  $1_1 = $1_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, $3_1 = 0, i64toi32_i32$2 = 0, i64toi32_i32$4 = 0, $2_1 = 0, $10_1 = 0, $2$hi = 0;
  block : {
   wasm2js_scratch_store_f64(+$0_1);
   i64toi32_i32$0 = wasm2js_scratch_load_i32(1 | 0) | 0;
   $2_1 = wasm2js_scratch_load_i32(0 | 0) | 0;
   $2$hi = i64toi32_i32$0;
   i64toi32_i32$2 = $2_1;
   i64toi32_i32$1 = 0;
   i64toi32_i32$3 = 52;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$1 = 0;
    $10_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
   } else {
    i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
    $10_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
   }
   $3_1 = $10_1 & 2047 | 0;
   if (($3_1 | 0) == (2047 | 0)) {
    break block
   }
   block1 : {
    if ($3_1) {
     break block1
    }
    block3 : {
     block2 : {
      if ($0_1 != 0.0) {
       break block2
      }
      $3_1 = 0;
      break block3;
     }
     $0_1 = +$18(+($0_1 * 18446744073709551615.0), $1_1 | 0);
     $3_1 = ($72($1_1 | 0, 0 | 0) | 0) + -64 | 0;
    }
    $101($1_1 | 0, 0 | 0, $3_1 | 0);
    return +$0_1;
   }
   $101($1_1 | 0, 0 | 0, $3_1 + -1022 | 0 | 0);
   i64toi32_i32$1 = $2$hi;
   i64toi32_i32$0 = $2_1;
   i64toi32_i32$2 = -2146435073;
   i64toi32_i32$3 = -1;
   i64toi32_i32$2 = i64toi32_i32$1 & i64toi32_i32$2 | 0;
   i64toi32_i32$1 = i64toi32_i32$0 & i64toi32_i32$3 | 0;
   i64toi32_i32$0 = 1071644672;
   i64toi32_i32$3 = 0;
   i64toi32_i32$0 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
   wasm2js_scratch_store_i32(0 | 0, i64toi32_i32$1 | i64toi32_i32$3 | 0 | 0);
   wasm2js_scratch_store_i32(1 | 0, i64toi32_i32$0 | 0);
   $0_1 = +wasm2js_scratch_load_f64();
  }
  return +$0_1;
 }
 
 function $19($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0, $5_1 = 0;
  block : {
   if ($2_1 >>> 0 < 512 >>> 0) {
    break block
   }
   fimport$1($0_1 | 0, $1_1 | 0, $2_1 | 0);
   return $0_1 | 0;
  }
  $3_1 = $0_1 + $2_1 | 0;
  block6 : {
   block1 : {
    if (($1_1 ^ $0_1 | 0) & 3 | 0) {
     break block1
    }
    block3 : {
     block2 : {
      if ($0_1 & 3 | 0) {
       break block2
      }
      $2_1 = $0_1;
      break block3;
     }
     block4 : {
      if ($2_1) {
       break block4
      }
      $2_1 = $0_1;
      break block3;
     }
     $2_1 = $0_1;
     label : while (1) {
      $96($2_1 | 0, 0 | 0, $65($1_1 | 0, 0 | 0) | 0 | 0);
      $1_1 = $1_1 + 1 | 0;
      $2_1 = $2_1 + 1 | 0;
      if (!($2_1 & 3 | 0)) {
       break block3
      }
      if ($2_1 >>> 0 < $3_1 >>> 0) {
       continue label
      }
      break label;
     };
    }
    $4_1 = $3_1 & -4 | 0;
    block5 : {
     if ($3_1 >>> 0 < 64 >>> 0) {
      break block5
     }
     $5_1 = $4_1 + -64 | 0;
     if ($2_1 >>> 0 > $5_1 >>> 0) {
      break block5
     }
     label1 : while (1) {
      $101($2_1 | 0, 0 | 0, $72($1_1 | 0, 0 | 0) | 0 | 0);
      $101($2_1 | 0, 4 | 0, $72($1_1 | 0, 4 | 0) | 0 | 0);
      $101($2_1 | 0, 8 | 0, $72($1_1 | 0, 8 | 0) | 0 | 0);
      $101($2_1 | 0, 12 | 0, $72($1_1 | 0, 12 | 0) | 0 | 0);
      $101($2_1 | 0, 16 | 0, $72($1_1 | 0, 16 | 0) | 0 | 0);
      $101($2_1 | 0, 20 | 0, $72($1_1 | 0, 20 | 0) | 0 | 0);
      $101($2_1 | 0, 24 | 0, $72($1_1 | 0, 24 | 0) | 0 | 0);
      $101($2_1 | 0, 28 | 0, $72($1_1 | 0, 28 | 0) | 0 | 0);
      $101($2_1 | 0, 32 | 0, $72($1_1 | 0, 32 | 0) | 0 | 0);
      $101($2_1 | 0, 36 | 0, $72($1_1 | 0, 36 | 0) | 0 | 0);
      $101($2_1 | 0, 40 | 0, $72($1_1 | 0, 40 | 0) | 0 | 0);
      $101($2_1 | 0, 44 | 0, $72($1_1 | 0, 44 | 0) | 0 | 0);
      $101($2_1 | 0, 48 | 0, $72($1_1 | 0, 48 | 0) | 0 | 0);
      $101($2_1 | 0, 52 | 0, $72($1_1 | 0, 52 | 0) | 0 | 0);
      $101($2_1 | 0, 56 | 0, $72($1_1 | 0, 56 | 0) | 0 | 0);
      $101($2_1 | 0, 60 | 0, $72($1_1 | 0, 60 | 0) | 0 | 0);
      $1_1 = $1_1 + 64 | 0;
      $2_1 = $2_1 + 64 | 0;
      if ($2_1 >>> 0 <= $5_1 >>> 0) {
       continue label1
      }
      break label1;
     };
    }
    if ($2_1 >>> 0 >= $4_1 >>> 0) {
     break block6
    }
    label2 : while (1) {
     $101($2_1 | 0, 0 | 0, $72($1_1 | 0, 0 | 0) | 0 | 0);
     $1_1 = $1_1 + 4 | 0;
     $2_1 = $2_1 + 4 | 0;
     if ($2_1 >>> 0 < $4_1 >>> 0) {
      continue label2
     }
     break block6;
    };
   }
   block7 : {
    if ($3_1 >>> 0 >= 4 >>> 0) {
     break block7
    }
    $2_1 = $0_1;
    break block6;
   }
   block8 : {
    $4_1 = $3_1 + -4 | 0;
    if ($0_1 >>> 0 <= $4_1 >>> 0) {
     break block8
    }
    $2_1 = $0_1;
    break block6;
   }
   $2_1 = $0_1;
   label3 : while (1) {
    $96($2_1 | 0, 0 | 0, $65($1_1 | 0, 0 | 0) | 0 | 0);
    $96($2_1 | 0, 1 | 0, $65($1_1 | 0, 1 | 0) | 0 | 0);
    $96($2_1 | 0, 2 | 0, $65($1_1 | 0, 2 | 0) | 0 | 0);
    $96($2_1 | 0, 3 | 0, $65($1_1 | 0, 3 | 0) | 0 | 0);
    $1_1 = $1_1 + 4 | 0;
    $2_1 = $2_1 + 4 | 0;
    if ($2_1 >>> 0 <= $4_1 >>> 0) {
     continue label3
    }
    break label3;
   };
  }
  block9 : {
   if ($2_1 >>> 0 >= $3_1 >>> 0) {
    break block9
   }
   label4 : while (1) {
    $96($2_1 | 0, 0 | 0, $65($1_1 | 0, 0 | 0) | 0 | 0);
    $1_1 = $1_1 + 1 | 0;
    $2_1 = $2_1 + 1 | 0;
    if (($2_1 | 0) != ($3_1 | 0)) {
     continue label4
    }
    break label4;
   };
  }
  return $0_1 | 0;
 }
 
 function $20($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0, $4_1 = 0, $5_1 = 0;
  block1 : {
   block : {
    $3_1 = $72($2_1 | 0, 16 | 0) | 0;
    if ($3_1) {
     break block
    }
    $4_1 = 0;
    if ($14($2_1 | 0) | 0) {
     break block1
    }
    $3_1 = $72($2_1 | 0, 16 | 0) | 0;
   }
   block2 : {
    $4_1 = $72($2_1 | 0, 20 | 0) | 0;
    if ($1_1 >>> 0 <= ($3_1 - $4_1 | 0) >>> 0) {
     break block2
    }
    return FUNCTION_TABLE[$72($2_1 | 0, 36 | 0) | 0 | 0]($2_1, $0_1, $1_1) | 0 | 0;
   }
   block5 : {
    block3 : {
     if (($72($2_1 | 0, 80 | 0) | 0 | 0) < (0 | 0)) {
      break block3
     }
     if (!$1_1) {
      break block3
     }
     $3_1 = $1_1;
     block4 : {
      label : while (1) {
       $5_1 = $0_1 + $3_1 | 0;
       if (($65($5_1 + -1 | 0 | 0, 0 | 0) | 0 | 0) == (10 | 0)) {
        break block4
       }
       $3_1 = $3_1 + -1 | 0;
       if (!$3_1) {
        break block3
       }
       continue label;
      };
     }
     $4_1 = FUNCTION_TABLE[$72($2_1 | 0, 36 | 0) | 0 | 0]($2_1, $0_1, $3_1) | 0;
     if ($4_1 >>> 0 < $3_1 >>> 0) {
      break block1
     }
     $1_1 = $1_1 - $3_1 | 0;
     $4_1 = $72($2_1 | 0, 20 | 0) | 0;
     break block5;
    }
    $5_1 = $0_1;
    $3_1 = 0;
   }
   $19($4_1 | 0, $5_1 | 0, $1_1 | 0) | 0;
   $101($2_1 | 0, 20 | 0, ($72($2_1 | 0, 20 | 0) | 0) + $1_1 | 0 | 0);
   $4_1 = $3_1 + $1_1 | 0;
  }
  return $4_1 | 0;
 }
 
 function $21($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $5_1 = 0, i64toi32_i32$0 = 0, $8_1 = 0, $6_1 = 0, $7_1 = 0;
  $5_1 = global$0 - 208 | 0;
  global$0 = $5_1;
  $101($5_1 | 0, 204 | 0, $2_1 | 0);
  $7($5_1 + 160 | 0 | 0, 0 | 0, 40 | 0) | 0;
  $101($5_1 | 0, 200 | 0, $72($5_1 | 0, 204 | 0) | 0 | 0);
  block1 : {
   block : {
    if (($22(0 | 0, $1_1 | 0, $5_1 + 200 | 0 | 0, $5_1 + 80 | 0 | 0, $5_1 + 160 | 0 | 0, $3_1 | 0, $4_1 | 0) | 0 | 0) >= (0 | 0)) {
     break block
    }
    $4_1 = -1;
    break block1;
   }
   block3 : {
    block2 : {
     if (($72($0_1 | 0, 76 | 0) | 0 | 0) >= (0 | 0)) {
      break block2
     }
     $6_1 = 1;
     break block3;
    }
    $6_1 = !($8($0_1 | 0) | 0);
   }
   $7_1 = $72($0_1 | 0, 0 | 0) | 0;
   $101($0_1 | 0, 0 | 0, $7_1 & -33 | 0 | 0);
   block7 : {
    block6 : {
     block5 : {
      block4 : {
       if ($72($0_1 | 0, 48 | 0) | 0) {
        break block4
       }
       $101($0_1 | 0, 48 | 0, 80 | 0);
       $101($0_1 | 0, 28 | 0, 0 | 0);
       i64toi32_i32$0 = 0;
       $111($0_1 | 0, 16 | 0, 0 | 0, i64toi32_i32$0 | 0);
       $8_1 = $72($0_1 | 0, 44 | 0) | 0;
       $101($0_1 | 0, 44 | 0, $5_1 | 0);
       break block5;
      }
      $8_1 = 0;
      if ($72($0_1 | 0, 16 | 0) | 0) {
       break block6
      }
     }
     $2_1 = -1;
     if ($14($0_1 | 0) | 0) {
      break block7
     }
    }
    $2_1 = $22($0_1 | 0, $1_1 | 0, $5_1 + 200 | 0 | 0, $5_1 + 80 | 0 | 0, $5_1 + 160 | 0 | 0, $3_1 | 0, $4_1 | 0) | 0;
   }
   $4_1 = $7_1 & 32 | 0;
   block8 : {
    if (!$8_1) {
     break block8
    }
    FUNCTION_TABLE[$72($0_1 | 0, 36 | 0) | 0 | 0]($0_1, 0, 0) | 0;
    $101($0_1 | 0, 48 | 0, 0 | 0);
    $101($0_1 | 0, 44 | 0, $8_1 | 0);
    $101($0_1 | 0, 28 | 0, 0 | 0);
    $3_1 = $72($0_1 | 0, 20 | 0) | 0;
    i64toi32_i32$0 = 0;
    $111($0_1 | 0, 16 | 0, 0 | 0, i64toi32_i32$0 | 0);
    $2_1 = $3_1 ? $2_1 : -1;
   }
   $3_1 = $72($0_1 | 0, 0 | 0) | 0;
   $101($0_1 | 0, 0 | 0, $3_1 | $4_1 | 0 | 0);
   $4_1 = $3_1 & 32 | 0 ? -1 : $2_1;
   if ($6_1) {
    break block1
   }
   $9($0_1 | 0);
  }
  global$0 = $5_1 + 208 | 0;
  return $4_1 | 0;
 }
 
 function $22($0_1, $1_1, $2_1, $3_1, $4_1, $5_1, $6_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  $5_1 = $5_1 | 0;
  $6_1 = $6_1 | 0;
  var $12_1 = 0, $7_1 = 0, $15_1 = 0, $20_1 = 0, $17_1 = 0, $14_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, $13_1 = 0, $11_1 = 0, $16_1 = 0, $19_1 = 0, $22_1 = 0, $18_1 = 0, $25_1 = 0, $25$hi = 0, i64toi32_i32$5 = 0, $9_1 = 0, i64toi32_i32$2 = 0, $24_1 = 0, $10_1 = 0, i64toi32_i32$3 = 0, $21_1 = 0, $23_1 = 0, $32_1 = 0, $33_1 = 0, $34_1 = 0, $8_1 = 0;
  $7_1 = global$0 - 64 | 0;
  global$0 = $7_1;
  $101($7_1 | 0, 60 | 0, $1_1 | 0);
  $8_1 = $7_1 + 39 | 0;
  $9_1 = $7_1 + 40 | 0;
  $10_1 = 0;
  $11_1 = 0;
  block68 : {
   block32 : {
    block26 : {
     block : {
      label4 : while (1) {
       $12_1 = 0;
       label1 : while (1) {
        $13_1 = $1_1;
        if (($12_1 | 0) > ($11_1 ^ 2147483647 | 0 | 0)) {
         break block
        }
        $11_1 = $12_1 + $11_1 | 0;
        $12_1 = $1_1;
        block31 : {
         block34 : {
          block47 : {
           block60 : {
            block15 : {
             block1 : {
              $14_1 = $65($12_1 | 0, 0 | 0) | 0;
              if (!$14_1) {
               break block1
              }
              label7 : while (1) {
               block4 : {
                block3 : {
                 block2 : {
                  $14_1 = $14_1 & 255 | 0;
                  if ($14_1) {
                   break block2
                  }
                  $1_1 = $12_1;
                  break block3;
                 }
                 if (($14_1 | 0) != (37 | 0)) {
                  break block4
                 }
                 $14_1 = $12_1;
                 label : while (1) {
                  block5 : {
                   if (($65($14_1 | 0, 1 | 0) | 0 | 0) == (37 | 0)) {
                    break block5
                   }
                   $1_1 = $14_1;
                   break block3;
                  }
                  $12_1 = $12_1 + 1 | 0;
                  $15_1 = $65($14_1 | 0, 2 | 0) | 0;
                  $1_1 = $14_1 + 2 | 0;
                  $14_1 = $1_1;
                  if (($15_1 | 0) == (37 | 0)) {
                   continue label
                  }
                  break label;
                 };
                }
                $12_1 = $12_1 - $13_1 | 0;
                $14_1 = $11_1 ^ 2147483647 | 0;
                if (($12_1 | 0) > ($14_1 | 0)) {
                 break block
                }
                block6 : {
                 if (!$0_1) {
                  break block6
                 }
                 $23($0_1 | 0, $13_1 | 0, $12_1 | 0);
                }
                if ($12_1) {
                 continue label1
                }
                $101($7_1 | 0, 60 | 0, $1_1 | 0);
                $12_1 = $1_1 + 1 | 0;
                $16_1 = -1;
                block7 : {
                 $15_1 = ($64($1_1 | 0, 1 | 0) | 0) + -48 | 0;
                 if ($15_1 >>> 0 > 9 >>> 0) {
                  break block7
                 }
                 if (($65($1_1 | 0, 2 | 0) | 0 | 0) != (36 | 0)) {
                  break block7
                 }
                 $12_1 = $1_1 + 3 | 0;
                 $10_1 = 1;
                 $16_1 = $15_1;
                }
                $101($7_1 | 0, 60 | 0, $12_1 | 0);
                $17_1 = 0;
                block9 : {
                 block8 : {
                  $18_1 = $64($12_1 | 0, 0 | 0) | 0;
                  $1_1 = $18_1 + -32 | 0;
                  if ($1_1 >>> 0 <= 31 >>> 0) {
                   break block8
                  }
                  $15_1 = $12_1;
                  break block9;
                 }
                 $17_1 = 0;
                 $15_1 = $12_1;
                 $1_1 = 1 << $1_1 | 0;
                 if (!($1_1 & 75913 | 0)) {
                  break block9
                 }
                 label2 : while (1) {
                  $15_1 = $12_1 + 1 | 0;
                  $101($7_1 | 0, 60 | 0, $15_1 | 0);
                  $17_1 = $1_1 | $17_1 | 0;
                  $18_1 = $64($12_1 | 0, 1 | 0) | 0;
                  $1_1 = $18_1 + -32 | 0;
                  if ($1_1 >>> 0 >= 32 >>> 0) {
                   break block9
                  }
                  $12_1 = $15_1;
                  $1_1 = 1 << $1_1 | 0;
                  if ($1_1 & 75913 | 0) {
                   continue label2
                  }
                  break label2;
                 };
                }
                block17 : {
                 block10 : {
                  if (($18_1 | 0) != (42 | 0)) {
                   break block10
                  }
                  block14 : {
                   block11 : {
                    $12_1 = ($64($15_1 | 0, 1 | 0) | 0) + -48 | 0;
                    if ($12_1 >>> 0 > 9 >>> 0) {
                     break block11
                    }
                    if (($65($15_1 | 0, 2 | 0) | 0 | 0) != (36 | 0)) {
                     break block11
                    }
                    block13 : {
                     block12 : {
                      if ($0_1) {
                       break block12
                      }
                      $101($4_1 + ($12_1 << 2 | 0) | 0 | 0, 0 | 0, 10 | 0);
                      $19_1 = 0;
                      break block13;
                     }
                     $19_1 = $72($3_1 + ($12_1 << 3 | 0) | 0 | 0, 0 | 0) | 0;
                    }
                    $1_1 = $15_1 + 3 | 0;
                    $10_1 = 1;
                    break block14;
                   }
                   if ($10_1) {
                    break block15
                   }
                   $1_1 = $15_1 + 1 | 0;
                   block16 : {
                    if ($0_1) {
                     break block16
                    }
                    $101($7_1 | 0, 60 | 0, $1_1 | 0);
                    $10_1 = 0;
                    $19_1 = 0;
                    break block17;
                   }
                   $12_1 = $72($2_1 | 0, 0 | 0) | 0;
                   $101($2_1 | 0, 0 | 0, $12_1 + 4 | 0 | 0);
                   $19_1 = $72($12_1 | 0, 0 | 0) | 0;
                   $10_1 = 0;
                  }
                  $101($7_1 | 0, 60 | 0, $1_1 | 0);
                  if (($19_1 | 0) > (-1 | 0)) {
                   break block17
                  }
                  $19_1 = 0 - $19_1 | 0;
                  $17_1 = $17_1 | 8192 | 0;
                  break block17;
                 }
                 $19_1 = $24($7_1 + 60 | 0 | 0) | 0;
                 if (($19_1 | 0) < (0 | 0)) {
                  break block
                 }
                 $1_1 = $72($7_1 | 0, 60 | 0) | 0;
                }
                $12_1 = 0;
                $20_1 = -1;
                block19 : {
                 block18 : {
                  if (($65($1_1 | 0, 0 | 0) | 0 | 0) == (46 | 0)) {
                   break block18
                  }
                  $21_1 = 0;
                  break block19;
                 }
                 block20 : {
                  if (($65($1_1 | 0, 1 | 0) | 0 | 0) != (42 | 0)) {
                   break block20
                  }
                  block24 : {
                   block21 : {
                    $15_1 = ($64($1_1 | 0, 2 | 0) | 0) + -48 | 0;
                    if ($15_1 >>> 0 > 9 >>> 0) {
                     break block21
                    }
                    if (($65($1_1 | 0, 3 | 0) | 0 | 0) != (36 | 0)) {
                     break block21
                    }
                    block23 : {
                     block22 : {
                      if ($0_1) {
                       break block22
                      }
                      $101($4_1 + ($15_1 << 2 | 0) | 0 | 0, 0 | 0, 10 | 0);
                      $20_1 = 0;
                      break block23;
                     }
                     $20_1 = $72($3_1 + ($15_1 << 3 | 0) | 0 | 0, 0 | 0) | 0;
                    }
                    $1_1 = $1_1 + 4 | 0;
                    break block24;
                   }
                   if ($10_1) {
                    break block15
                   }
                   $1_1 = $1_1 + 2 | 0;
                   block25 : {
                    if ($0_1) {
                     break block25
                    }
                    $20_1 = 0;
                    break block24;
                   }
                   $15_1 = $72($2_1 | 0, 0 | 0) | 0;
                   $101($2_1 | 0, 0 | 0, $15_1 + 4 | 0 | 0);
                   $20_1 = $72($15_1 | 0, 0 | 0) | 0;
                  }
                  $101($7_1 | 0, 60 | 0, $1_1 | 0);
                  $21_1 = ($20_1 | 0) > (-1 | 0);
                  break block19;
                 }
                 $101($7_1 | 0, 60 | 0, $1_1 + 1 | 0 | 0);
                 $21_1 = 1;
                 $20_1 = $24($7_1 + 60 | 0 | 0) | 0;
                 $1_1 = $72($7_1 | 0, 60 | 0) | 0;
                }
                label3 : while (1) {
                 $15_1 = $12_1;
                 $22_1 = 28;
                 $18_1 = $1_1;
                 $12_1 = $64($1_1 | 0, 0 | 0) | 0;
                 if (($12_1 + -123 | 0) >>> 0 < -58 >>> 0) {
                  break block26
                 }
                 $1_1 = $1_1 + 1 | 0;
                 $12_1 = $65(($12_1 + Math_imul($15_1, 58) | 0) + 65567 | 0 | 0, 0 | 0) | 0;
                 if ((($12_1 + -1 | 0) & 255 | 0) >>> 0 < 8 >>> 0) {
                  continue label3
                 }
                 break label3;
                };
                $101($7_1 | 0, 60 | 0, $1_1 | 0);
                block30 : {
                 block27 : {
                  if (($12_1 | 0) == (27 | 0)) {
                   break block27
                  }
                  if (!$12_1) {
                   break block26
                  }
                  block28 : {
                   if (($16_1 | 0) < (0 | 0)) {
                    break block28
                   }
                   block29 : {
                    if ($0_1) {
                     break block29
                    }
                    $101($4_1 + ($16_1 << 2 | 0) | 0 | 0, 0 | 0, $12_1 | 0);
                    continue label4;
                   }
                   i64toi32_i32$0 = $88($3_1 + ($16_1 << 3 | 0) | 0 | 0, 0 | 0) | 0;
                   i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
                   $111($7_1 | 0, 48 | 0, i64toi32_i32$0 | 0, i64toi32_i32$1 | 0);
                   break block30;
                  }
                  if (!$0_1) {
                   break block31
                  }
                  $25($7_1 + 48 | 0 | 0, $12_1 | 0, $2_1 | 0, $6_1 | 0);
                  break block30;
                 }
                 if (($16_1 | 0) > (-1 | 0)) {
                  break block26
                 }
                 $12_1 = 0;
                 if (!$0_1) {
                  continue label1
                 }
                }
                if (($65($0_1 | 0, 0 | 0) | 0) & 32 | 0) {
                 break block32
                }
                $23_1 = $17_1 & -65537 | 0;
                $17_1 = $17_1 & 8192 | 0 ? $23_1 : $17_1;
                $16_1 = 0;
                $24_1 = 65536;
                $22_1 = $9_1;
                block35 : {
                 block65 : {
                  block64 : {
                   block62 : {
                    block46 : {
                     block44 : {
                      block41 : {
                       block36 : {
                        block56 : {
                         block48 : {
                          block37 : {
                           block39 : {
                            block33 : {
                             block40 : {
                              block38 : {
                               block42 : {
                                block43 : {
                                 $18_1 = $65($18_1 | 0, 0 | 0) | 0;
                                 $12_1 = $18_1 << 24 >> 24;
                                 $12_1 = $15_1 ? (($18_1 & 15 | 0 | 0) == (3 | 0) ? $12_1 & -45 | 0 : $12_1) : $12_1;
                                 switch ($12_1 + -88 | 0 | 0) {
                                 case 0:
                                 case 32:
                                  break block33;
                                 case 1:
                                 case 2:
                                 case 3:
                                 case 4:
                                 case 5:
                                 case 6:
                                 case 7:
                                 case 8:
                                 case 10:
                                 case 16:
                                 case 18:
                                 case 19:
                                 case 20:
                                 case 21:
                                 case 25:
                                 case 26:
                                 case 28:
                                 case 30:
                                 case 31:
                                  break block34;
                                 case 9:
                                 case 13:
                                 case 14:
                                 case 15:
                                  break block35;
                                 case 11:
                                  break block36;
                                 case 12:
                                 case 17:
                                  break block37;
                                 case 22:
                                  break block38;
                                 case 23:
                                  break block39;
                                 case 24:
                                  break block40;
                                 case 27:
                                  break block41;
                                 case 29:
                                  break block42;
                                 default:
                                  break block43;
                                 };
                                }
                                $22_1 = $9_1;
                                block45 : {
                                 switch ($12_1 + -65 | 0 | 0) {
                                 case 1:
                                 case 3:
                                  break block34;
                                 case 0:
                                 case 4:
                                 case 5:
                                 case 6:
                                  break block35;
                                 case 2:
                                  break block44;
                                 default:
                                  break block45;
                                 };
                                }
                                if (($12_1 | 0) == (83 | 0)) {
                                 break block46
                                }
                                break block47;
                               }
                               $16_1 = 0;
                               $24_1 = 65536;
                               i64toi32_i32$1 = $88($7_1 | 0, 48 | 0) | 0;
                               i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
                               $25_1 = i64toi32_i32$1;
                               $25$hi = i64toi32_i32$0;
                               break block48;
                              }
                              $12_1 = 0;
                              block55 : {
                               switch ($15_1 | 0) {
                               case 0:
                                $101($72($7_1 | 0, 48 | 0) | 0 | 0, 0 | 0, $11_1 | 0);
                                continue label1;
                               case 1:
                                $101($72($7_1 | 0, 48 | 0) | 0 | 0, 0 | 0, $11_1 | 0);
                                continue label1;
                               case 2:
                                i64toi32_i32$1 = $11_1;
                                i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
                                $111($72($7_1 | 0, 48 | 0) | 0 | 0, 0 | 0, i64toi32_i32$1 | 0, i64toi32_i32$0 | 0);
                                continue label1;
                               case 3:
                                $98($72($7_1 | 0, 48 | 0) | 0 | 0, 0 | 0, $11_1 | 0);
                                continue label1;
                               case 4:
                                $96($72($7_1 | 0, 48 | 0) | 0 | 0, 0 | 0, $11_1 | 0);
                                continue label1;
                               case 6:
                                $101($72($7_1 | 0, 48 | 0) | 0 | 0, 0 | 0, $11_1 | 0);
                                continue label1;
                               case 7:
                                break block55;
                               default:
                                continue label1;
                               };
                              }
                              i64toi32_i32$1 = $11_1;
                              i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
                              $111($72($7_1 | 0, 48 | 0) | 0 | 0, 0 | 0, i64toi32_i32$1 | 0, i64toi32_i32$0 | 0);
                              continue label1;
                             }
                             $20_1 = $20_1 >>> 0 > 8 >>> 0 ? $20_1 : 8;
                             $17_1 = $17_1 | 8 | 0;
                             $12_1 = 120;
                            }
                            $16_1 = 0;
                            $24_1 = 65536;
                            i64toi32_i32$0 = $88($7_1 | 0, 48 | 0) | 0;
                            i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
                            $25_1 = i64toi32_i32$0;
                            $25$hi = i64toi32_i32$1;
                            $13_1 = $26(i64toi32_i32$0 | 0, i64toi32_i32$1 | 0, $9_1 | 0, $12_1 & 32 | 0 | 0) | 0;
                            if (!(i64toi32_i32$0 | i64toi32_i32$1 | 0)) {
                             break block56
                            }
                            if (!($17_1 & 8 | 0)) {
                             break block56
                            }
                            $24_1 = ($12_1 >>> 4 | 0) + 65536 | 0;
                            $16_1 = 2;
                            break block56;
                           }
                           $16_1 = 0;
                           $24_1 = 65536;
                           i64toi32_i32$1 = $88($7_1 | 0, 48 | 0) | 0;
                           i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
                           $25_1 = i64toi32_i32$1;
                           $25$hi = i64toi32_i32$0;
                           $13_1 = $27(i64toi32_i32$1 | 0, i64toi32_i32$0 | 0, $9_1 | 0) | 0;
                           if (!($17_1 & 8 | 0)) {
                            break block56
                           }
                           $12_1 = $9_1 - $13_1 | 0;
                           $20_1 = ($20_1 | 0) > ($12_1 | 0) ? $20_1 : $12_1 + 1 | 0;
                           break block56;
                          }
                          block57 : {
                           i64toi32_i32$0 = $88($7_1 | 0, 48 | 0) | 0;
                           i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
                           $25_1 = i64toi32_i32$0;
                           $25$hi = i64toi32_i32$1;
                           i64toi32_i32$2 = i64toi32_i32$0;
                           i64toi32_i32$0 = -1;
                           i64toi32_i32$3 = -1;
                           if ((i64toi32_i32$1 | 0) > (i64toi32_i32$0 | 0)) {
                            $32_1 = 1
                           } else {
                            if ((i64toi32_i32$1 | 0) >= (i64toi32_i32$0 | 0)) {
                             if (i64toi32_i32$2 >>> 0 <= i64toi32_i32$3 >>> 0) {
                              $33_1 = 0
                             } else {
                              $33_1 = 1
                             }
                             $34_1 = $33_1;
                            } else {
                             $34_1 = 0
                            }
                            $32_1 = $34_1;
                           }
                           if ($32_1) {
                            break block57
                           }
                           i64toi32_i32$2 = $25$hi;
                           i64toi32_i32$2 = 0;
                           i64toi32_i32$3 = 0;
                           i64toi32_i32$1 = $25$hi;
                           i64toi32_i32$0 = $25_1;
                           i64toi32_i32$5 = (i64toi32_i32$3 >>> 0 < i64toi32_i32$0 >>> 0) + i64toi32_i32$1 | 0;
                           i64toi32_i32$5 = i64toi32_i32$2 - i64toi32_i32$5 | 0;
                           $25_1 = i64toi32_i32$3 - i64toi32_i32$0 | 0;
                           $25$hi = i64toi32_i32$5;
                           $111($7_1 | 0, 48 | 0, $25_1 | 0, i64toi32_i32$5 | 0);
                           $16_1 = 1;
                           $24_1 = 65536;
                           break block48;
                          }
                          block58 : {
                           if (!($17_1 & 2048 | 0)) {
                            break block58
                           }
                           $16_1 = 1;
                           $24_1 = 65537;
                           break block48;
                          }
                          $16_1 = $17_1 & 1 | 0;
                          $24_1 = $16_1 ? 65538 : 65536;
                         }
                         i64toi32_i32$5 = $25$hi;
                         $13_1 = $28($25_1 | 0, i64toi32_i32$5 | 0, $9_1 | 0) | 0;
                        }
                        if ($21_1 & ($20_1 | 0) < (0 | 0) | 0) {
                         break block
                        }
                        $17_1 = $21_1 ? $17_1 & -65537 | 0 : $17_1;
                        block59 : {
                         i64toi32_i32$5 = $25$hi;
                         i64toi32_i32$2 = $25_1;
                         i64toi32_i32$3 = 0;
                         i64toi32_i32$0 = 0;
                         if (($25_1 | 0) != (i64toi32_i32$0 | 0) | (i64toi32_i32$5 | 0) != (i64toi32_i32$3 | 0) | 0) {
                          break block59
                         }
                         if ($20_1) {
                          break block59
                         }
                         $13_1 = $9_1;
                         $22_1 = $13_1;
                         $20_1 = 0;
                         break block34;
                        }
                        i64toi32_i32$2 = $25$hi;
                        i64toi32_i32$2 = $25$hi;
                        $12_1 = ($9_1 - $13_1 | 0) + !($25_1 | $25$hi | 0) | 0;
                        $20_1 = ($20_1 | 0) > ($12_1 | 0) ? $20_1 : $12_1;
                        break block47;
                       }
                       $12_1 = $65($7_1 | 0, 48 | 0) | 0;
                       break block60;
                      }
                      $12_1 = $72($7_1 | 0, 48 | 0) | 0;
                      $13_1 = $12_1 ? $12_1 : 65583;
                      $12_1 = $16($13_1 | 0, ($20_1 >>> 0 < 2147483647 >>> 0 ? $20_1 : 2147483647) | 0) | 0;
                      $22_1 = $13_1 + $12_1 | 0;
                      block61 : {
                       if (($20_1 | 0) <= (-1 | 0)) {
                        break block61
                       }
                       $17_1 = $23_1;
                       $20_1 = $12_1;
                       break block34;
                      }
                      $17_1 = $23_1;
                      $20_1 = $12_1;
                      if ($65($22_1 | 0, 0 | 0) | 0) {
                       break block
                      }
                      break block34;
                     }
                     i64toi32_i32$2 = $88($7_1 | 0, 48 | 0) | 0;
                     i64toi32_i32$5 = i64toi32_i32$HIGH_BITS;
                     $25_1 = i64toi32_i32$2;
                     $25$hi = i64toi32_i32$5;
                     if (!!($25_1 | i64toi32_i32$5 | 0)) {
                      break block62
                     }
                     $12_1 = 0;
                     break block60;
                    }
                    block63 : {
                     if (!$20_1) {
                      break block63
                     }
                     $14_1 = $72($7_1 | 0, 48 | 0) | 0;
                     break block64;
                    }
                    $12_1 = 0;
                    $29($0_1 | 0, 32 | 0, $19_1 | 0, 0 | 0, $17_1 | 0);
                    break block65;
                   }
                   $101($7_1 | 0, 12 | 0, 0 | 0);
                   i64toi32_i32$5 = $25$hi;
                   $107($7_1 | 0, 8 | 0, $25_1 | 0, i64toi32_i32$5 | 0);
                   $101($7_1 | 0, 48 | 0, $7_1 + 8 | 0 | 0);
                   $14_1 = $7_1 + 8 | 0;
                   $20_1 = -1;
                  }
                  $12_1 = 0;
                  block66 : {
                   label5 : while (1) {
                    $15_1 = $72($14_1 | 0, 0 | 0) | 0;
                    if (!$15_1) {
                     break block66
                    }
                    $15_1 = $40($7_1 + 4 | 0 | 0, $15_1 | 0) | 0;
                    if (($15_1 | 0) < (0 | 0)) {
                     break block32
                    }
                    if ($15_1 >>> 0 > ($20_1 - $12_1 | 0) >>> 0) {
                     break block66
                    }
                    $14_1 = $14_1 + 4 | 0;
                    $12_1 = $15_1 + $12_1 | 0;
                    if ($12_1 >>> 0 < $20_1 >>> 0) {
                     continue label5
                    }
                    break label5;
                   };
                  }
                  $22_1 = 61;
                  if (($12_1 | 0) < (0 | 0)) {
                   break block26
                  }
                  $29($0_1 | 0, 32 | 0, $19_1 | 0, $12_1 | 0, $17_1 | 0);
                  block67 : {
                   if ($12_1) {
                    break block67
                   }
                   $12_1 = 0;
                   break block65;
                  }
                  $15_1 = 0;
                  $14_1 = $72($7_1 | 0, 48 | 0) | 0;
                  label6 : while (1) {
                   $13_1 = $72($14_1 | 0, 0 | 0) | 0;
                   if (!$13_1) {
                    break block65
                   }
                   $13_1 = $40($7_1 + 4 | 0 | 0, $13_1 | 0) | 0;
                   $15_1 = $13_1 + $15_1 | 0;
                   if ($15_1 >>> 0 > $12_1 >>> 0) {
                    break block65
                   }
                   $23($0_1 | 0, $7_1 + 4 | 0 | 0, $13_1 | 0);
                   $14_1 = $14_1 + 4 | 0;
                   if ($15_1 >>> 0 < $12_1 >>> 0) {
                    continue label6
                   }
                   break label6;
                  };
                 }
                 $29($0_1 | 0, 32 | 0, $19_1 | 0, $12_1 | 0, $17_1 ^ 8192 | 0 | 0);
                 $12_1 = ($19_1 | 0) > ($12_1 | 0) ? $19_1 : $12_1;
                 continue label1;
                }
                if ($21_1 & ($20_1 | 0) < (0 | 0) | 0) {
                 break block
                }
                $22_1 = 61;
                $12_1 = FUNCTION_TABLE[$5_1 | 0]($0_1, +$95($7_1 | 0, 48 | 0), $19_1, $20_1, $17_1, $12_1) | 0;
                if (($12_1 | 0) >= (0 | 0)) {
                 continue label1
                }
                break block26;
               }
               $14_1 = $65($12_1 | 0, 1 | 0) | 0;
               $12_1 = $12_1 + 1 | 0;
               continue label7;
              };
             }
             if ($0_1) {
              break block68
             }
             if (!$10_1) {
              break block31
             }
             $12_1 = 1;
             block69 : {
              label8 : while (1) {
               $14_1 = $72($4_1 + ($12_1 << 2 | 0) | 0 | 0, 0 | 0) | 0;
               if (!$14_1) {
                break block69
               }
               $25($3_1 + ($12_1 << 3 | 0) | 0 | 0, $14_1 | 0, $2_1 | 0, $6_1 | 0);
               $11_1 = 1;
               $12_1 = $12_1 + 1 | 0;
               if (($12_1 | 0) != (10 | 0)) {
                continue label8
               }
               break block68;
              };
             }
             block70 : {
              if ($12_1 >>> 0 < 10 >>> 0) {
               break block70
              }
              $11_1 = 1;
              break block68;
             }
             label9 : while (1) {
              if ($72($4_1 + ($12_1 << 2 | 0) | 0 | 0, 0 | 0) | 0) {
               break block15
              }
              $11_1 = 1;
              $12_1 = $12_1 + 1 | 0;
              if (($12_1 | 0) == (10 | 0)) {
               break block68
              }
              continue label9;
             };
            }
            $22_1 = 28;
            break block26;
           }
           $96($7_1 | 0, 39 | 0, $12_1 | 0);
           $20_1 = 1;
           $13_1 = $8_1;
           $22_1 = $9_1;
           $17_1 = $23_1;
           break block34;
          }
          $22_1 = $9_1;
         }
         $1_1 = $22_1 - $13_1 | 0;
         $18_1 = ($20_1 | 0) > ($1_1 | 0) ? $20_1 : $1_1;
         if (($18_1 | 0) > ($16_1 ^ 2147483647 | 0 | 0)) {
          break block
         }
         $22_1 = 61;
         $15_1 = $16_1 + $18_1 | 0;
         $12_1 = ($19_1 | 0) > ($15_1 | 0) ? $19_1 : $15_1;
         if (($12_1 | 0) > ($14_1 | 0)) {
          break block26
         }
         $29($0_1 | 0, 32 | 0, $12_1 | 0, $15_1 | 0, $17_1 | 0);
         $23($0_1 | 0, $24_1 | 0, $16_1 | 0);
         $29($0_1 | 0, 48 | 0, $12_1 | 0, $15_1 | 0, $17_1 ^ 65536 | 0 | 0);
         $29($0_1 | 0, 48 | 0, $18_1 | 0, $1_1 | 0, 0 | 0);
         $23($0_1 | 0, $13_1 | 0, $1_1 | 0);
         $29($0_1 | 0, 32 | 0, $12_1 | 0, $15_1 | 0, $17_1 ^ 8192 | 0 | 0);
         $1_1 = $72($7_1 | 0, 60 | 0) | 0;
         continue label1;
        }
        break label1;
       };
       break label4;
      };
      $11_1 = 0;
      break block68;
     }
     $22_1 = 61;
    }
    $101($17() | 0 | 0, 0 | 0, $22_1 | 0);
   }
   $11_1 = -1;
  }
  global$0 = $7_1 + 64 | 0;
  return $11_1 | 0;
 }
 
 function $23($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  block : {
   if (($65($0_1 | 0, 0 | 0) | 0) & 32 | 0) {
    break block
   }
   $20($1_1 | 0, $2_1 | 0, $0_1 | 0) | 0;
  }
 }
 
 function $24($0_1) {
  $0_1 = $0_1 | 0;
  var $3_1 = 0, $1_1 = 0, $2_1 = 0, $4_1 = 0, $5_1 = 0;
  $1_1 = 0;
  block : {
   $2_1 = $72($0_1 | 0, 0 | 0) | 0;
   $3_1 = ($64($2_1 | 0, 0 | 0) | 0) + -48 | 0;
   if ($3_1 >>> 0 <= 9 >>> 0) {
    break block
   }
   return 0 | 0;
  }
  label : while (1) {
   $4_1 = -1;
   block1 : {
    if ($1_1 >>> 0 > 214748364 >>> 0) {
     break block1
    }
    $1_1 = Math_imul($1_1, 10);
    $4_1 = $3_1 >>> 0 > ($1_1 ^ 2147483647 | 0) >>> 0 ? -1 : $3_1 + $1_1 | 0;
   }
   $3_1 = $2_1 + 1 | 0;
   $101($0_1 | 0, 0 | 0, $3_1 | 0);
   $5_1 = $64($2_1 | 0, 1 | 0) | 0;
   $1_1 = $4_1;
   $2_1 = $3_1;
   $3_1 = $5_1 + -48 | 0;
   if ($3_1 >>> 0 < 10 >>> 0) {
    continue label
   }
   break label;
  };
  return $1_1 | 0;
 }
 
 function $25($0_1, $1_1, $2_1, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  block18 : {
   switch ($1_1 + -9 | 0 | 0) {
   case 0:
    $1_1 = $72($2_1 | 0, 0 | 0) | 0;
    $101($2_1 | 0, 0 | 0, $1_1 + 4 | 0 | 0);
    $101($0_1 | 0, 0 | 0, $72($1_1 | 0, 0 | 0) | 0 | 0);
    return;
   case 1:
    $1_1 = $72($2_1 | 0, 0 | 0) | 0;
    $101($2_1 | 0, 0 | 0, $1_1 + 4 | 0 | 0);
    i64toi32_i32$0 = $81($1_1 | 0, 0 | 0) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $111($0_1 | 0, 0 | 0, i64toi32_i32$0 | 0, i64toi32_i32$1 | 0);
    return;
   case 2:
    $1_1 = $72($2_1 | 0, 0 | 0) | 0;
    $101($2_1 | 0, 0 | 0, $1_1 + 4 | 0 | 0);
    i64toi32_i32$1 = $84($1_1 | 0, 0 | 0) | 0;
    i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
    $111($0_1 | 0, 0 | 0, i64toi32_i32$1 | 0, i64toi32_i32$0 | 0);
    return;
   case 4:
    $1_1 = $72($2_1 | 0, 0 | 0) | 0;
    $101($2_1 | 0, 0 | 0, $1_1 + 4 | 0 | 0);
    i64toi32_i32$0 = $81($1_1 | 0, 0 | 0) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $111($0_1 | 0, 0 | 0, i64toi32_i32$0 | 0, i64toi32_i32$1 | 0);
    return;
   case 5:
    $1_1 = $72($2_1 | 0, 0 | 0) | 0;
    $101($2_1 | 0, 0 | 0, $1_1 + 4 | 0 | 0);
    i64toi32_i32$1 = $84($1_1 | 0, 0 | 0) | 0;
    i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
    $111($0_1 | 0, 0 | 0, i64toi32_i32$1 | 0, i64toi32_i32$0 | 0);
    return;
   case 3:
    $1_1 = (($72($2_1 | 0, 0 | 0) | 0) + 7 | 0) & -8 | 0;
    $101($2_1 | 0, 0 | 0, $1_1 + 8 | 0 | 0);
    i64toi32_i32$0 = $88($1_1 | 0, 0 | 0) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $111($0_1 | 0, 0 | 0, i64toi32_i32$0 | 0, i64toi32_i32$1 | 0);
    return;
   case 6:
    $1_1 = $72($2_1 | 0, 0 | 0) | 0;
    $101($2_1 | 0, 0 | 0, $1_1 + 4 | 0 | 0);
    i64toi32_i32$1 = $76($1_1 | 0, 0 | 0) | 0;
    i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
    $111($0_1 | 0, 0 | 0, i64toi32_i32$1 | 0, i64toi32_i32$0 | 0);
    return;
   case 7:
    $1_1 = $72($2_1 | 0, 0 | 0) | 0;
    $101($2_1 | 0, 0 | 0, $1_1 + 4 | 0 | 0);
    i64toi32_i32$0 = $78($1_1 | 0, 0 | 0) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $111($0_1 | 0, 0 | 0, i64toi32_i32$0 | 0, i64toi32_i32$1 | 0);
    return;
   case 8:
    $1_1 = $72($2_1 | 0, 0 | 0) | 0;
    $101($2_1 | 0, 0 | 0, $1_1 + 4 | 0 | 0);
    i64toi32_i32$1 = $73($1_1 | 0, 0 | 0) | 0;
    i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
    $111($0_1 | 0, 0 | 0, i64toi32_i32$1 | 0, i64toi32_i32$0 | 0);
    return;
   case 9:
    $1_1 = $72($2_1 | 0, 0 | 0) | 0;
    $101($2_1 | 0, 0 | 0, $1_1 + 4 | 0 | 0);
    i64toi32_i32$0 = $74($1_1 | 0, 0 | 0) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $111($0_1 | 0, 0 | 0, i64toi32_i32$0 | 0, i64toi32_i32$1 | 0);
    return;
   case 10:
    $1_1 = (($72($2_1 | 0, 0 | 0) | 0) + 7 | 0) & -8 | 0;
    $101($2_1 | 0, 0 | 0, $1_1 + 8 | 0 | 0);
    i64toi32_i32$1 = $88($1_1 | 0, 0 | 0) | 0;
    i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
    $111($0_1 | 0, 0 | 0, i64toi32_i32$1 | 0, i64toi32_i32$0 | 0);
    return;
   case 11:
    $1_1 = $72($2_1 | 0, 0 | 0) | 0;
    $101($2_1 | 0, 0 | 0, $1_1 + 4 | 0 | 0);
    i64toi32_i32$0 = $84($1_1 | 0, 0 | 0) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $111($0_1 | 0, 0 | 0, i64toi32_i32$0 | 0, i64toi32_i32$1 | 0);
    return;
   case 12:
    $1_1 = (($72($2_1 | 0, 0 | 0) | 0) + 7 | 0) & -8 | 0;
    $101($2_1 | 0, 0 | 0, $1_1 + 8 | 0 | 0);
    i64toi32_i32$1 = $88($1_1 | 0, 0 | 0) | 0;
    i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
    $111($0_1 | 0, 0 | 0, i64toi32_i32$1 | 0, i64toi32_i32$0 | 0);
    return;
   case 13:
    $1_1 = (($72($2_1 | 0, 0 | 0) | 0) + 7 | 0) & -8 | 0;
    $101($2_1 | 0, 0 | 0, $1_1 + 8 | 0 | 0);
    i64toi32_i32$0 = $88($1_1 | 0, 0 | 0) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $111($0_1 | 0, 0 | 0, i64toi32_i32$0 | 0, i64toi32_i32$1 | 0);
    return;
   case 14:
    $1_1 = $72($2_1 | 0, 0 | 0) | 0;
    $101($2_1 | 0, 0 | 0, $1_1 + 4 | 0 | 0);
    i64toi32_i32$1 = $81($1_1 | 0, 0 | 0) | 0;
    i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
    $111($0_1 | 0, 0 | 0, i64toi32_i32$1 | 0, i64toi32_i32$0 | 0);
    return;
   case 15:
    $1_1 = $72($2_1 | 0, 0 | 0) | 0;
    $101($2_1 | 0, 0 | 0, $1_1 + 4 | 0 | 0);
    i64toi32_i32$0 = $84($1_1 | 0, 0 | 0) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $111($0_1 | 0, 0 | 0, i64toi32_i32$0 | 0, i64toi32_i32$1 | 0);
    return;
   case 16:
    $1_1 = (($72($2_1 | 0, 0 | 0) | 0) + 7 | 0) & -8 | 0;
    $101($2_1 | 0, 0 | 0, $1_1 + 8 | 0 | 0);
    $118($0_1 | 0, 0 | 0, +(+$95($1_1 | 0, 0 | 0)));
    return;
   case 17:
    FUNCTION_TABLE[$3_1 | 0]($0_1, $2_1);
    break;
   default:
    break block18;
   };
  }
 }
 
 function $26($0_1, $0$hi, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $0$hi = $0$hi | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, i64toi32_i32$1 = 0, i64toi32_i32$4 = 0, i64toi32_i32$3 = 0, $10_1 = 0, $3_1 = 0;
  block : {
   i64toi32_i32$0 = $0$hi;
   if (!($0_1 | i64toi32_i32$0 | 0)) {
    break block
   }
   label : while (1) {
    $1_1 = $1_1 + -1 | 0;
    i64toi32_i32$0 = $0$hi;
    $96($1_1 | 0, 0 | 0, $65(($0_1 & 15 | 0) + 66096 | 0 | 0, 0 | 0) | 0 | $2_1 | 0 | 0);
    i64toi32_i32$2 = $0_1;
    i64toi32_i32$1 = 0;
    i64toi32_i32$3 = 15;
    $3_1 = i64toi32_i32$0 >>> 0 > i64toi32_i32$1 >>> 0 | ((i64toi32_i32$0 | 0) == (i64toi32_i32$1 | 0) & i64toi32_i32$2 >>> 0 > i64toi32_i32$3 >>> 0 | 0) | 0;
    i64toi32_i32$2 = i64toi32_i32$0;
    i64toi32_i32$2 = i64toi32_i32$0;
    i64toi32_i32$3 = $0_1;
    i64toi32_i32$0 = 0;
    i64toi32_i32$1 = 4;
    i64toi32_i32$4 = i64toi32_i32$1 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
     i64toi32_i32$0 = 0;
     $10_1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$0 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
     $10_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$4 | 0) | 0;
    }
    $0_1 = $10_1;
    $0$hi = i64toi32_i32$0;
    if ($3_1) {
     continue label
    }
    break label;
   };
  }
  return $1_1 | 0;
 }
 
 function $27($0_1, $0$hi, $1_1) {
  $0_1 = $0_1 | 0;
  $0$hi = $0$hi | 0;
  $1_1 = $1_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$2 = 0, i64toi32_i32$1 = 0, i64toi32_i32$4 = 0, i64toi32_i32$3 = 0, $9_1 = 0, $2_1 = 0;
  block : {
   i64toi32_i32$0 = $0$hi;
   if (!($0_1 | i64toi32_i32$0 | 0)) {
    break block
   }
   label : while (1) {
    $1_1 = $1_1 + -1 | 0;
    i64toi32_i32$0 = $0$hi;
    $96($1_1 | 0, 0 | 0, $0_1 & 7 | 0 | 48 | 0 | 0);
    i64toi32_i32$2 = $0_1;
    i64toi32_i32$1 = 0;
    i64toi32_i32$3 = 7;
    $2_1 = i64toi32_i32$0 >>> 0 > i64toi32_i32$1 >>> 0 | ((i64toi32_i32$0 | 0) == (i64toi32_i32$1 | 0) & i64toi32_i32$2 >>> 0 > i64toi32_i32$3 >>> 0 | 0) | 0;
    i64toi32_i32$2 = i64toi32_i32$0;
    i64toi32_i32$2 = i64toi32_i32$0;
    i64toi32_i32$3 = $0_1;
    i64toi32_i32$0 = 0;
    i64toi32_i32$1 = 3;
    i64toi32_i32$4 = i64toi32_i32$1 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
     i64toi32_i32$0 = 0;
     $9_1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$0 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
     $9_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$4 | 0) | 0;
    }
    $0_1 = $9_1;
    $0$hi = i64toi32_i32$0;
    if ($2_1) {
     continue label
    }
    break label;
   };
  }
  return $1_1 | 0;
 }
 
 function $28($0_1, $0$hi, $1_1) {
  $0_1 = $0_1 | 0;
  $0$hi = $0$hi | 0;
  $1_1 = $1_1 | 0;
  var i64toi32_i32$2 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$5 = 0, $3_1 = 0, i64toi32_i32$3 = 0, $2_1 = 0, $2$hi = 0, $4_1 = 0, $16_1 = 0, $16$hi = 0, $5_1 = 0;
  block1 : {
   block : {
    i64toi32_i32$0 = $0$hi;
    i64toi32_i32$2 = $0_1;
    i64toi32_i32$1 = 1;
    i64toi32_i32$3 = 0;
    if (i64toi32_i32$0 >>> 0 > i64toi32_i32$1 >>> 0 | ((i64toi32_i32$0 | 0) == (i64toi32_i32$1 | 0) & i64toi32_i32$2 >>> 0 >= i64toi32_i32$3 >>> 0 | 0) | 0) {
     break block
    }
    i64toi32_i32$2 = i64toi32_i32$0;
    $2_1 = $0_1;
    $2$hi = i64toi32_i32$2;
    break block1;
   }
   label : while (1) {
    $1_1 = $1_1 + -1 | 0;
    i64toi32_i32$2 = $0$hi;
    i64toi32_i32$0 = 0;
    i64toi32_i32$0 = __wasm_i64_udiv($0_1 | 0, i64toi32_i32$2 | 0, 10 | 0, i64toi32_i32$0 | 0) | 0;
    i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
    $2_1 = i64toi32_i32$0;
    $2$hi = i64toi32_i32$2;
    i64toi32_i32$0 = 0;
    i64toi32_i32$0 = __wasm_i64_mul($2_1 | 0, i64toi32_i32$2 | 0, 10 | 0, i64toi32_i32$0 | 0) | 0;
    i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
    $16_1 = i64toi32_i32$0;
    $16$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $0$hi;
    i64toi32_i32$3 = $0_1;
    i64toi32_i32$0 = $16$hi;
    i64toi32_i32$1 = $16_1;
    i64toi32_i32$5 = ($0_1 >>> 0 < i64toi32_i32$1 >>> 0) + i64toi32_i32$0 | 0;
    i64toi32_i32$5 = i64toi32_i32$2 - i64toi32_i32$5 | 0;
    $96($1_1 | 0, 0 | 0, $0_1 - i64toi32_i32$1 | 0 | 48 | 0 | 0);
    i64toi32_i32$5 = i64toi32_i32$2;
    i64toi32_i32$5 = i64toi32_i32$2;
    i64toi32_i32$2 = $0_1;
    i64toi32_i32$3 = 9;
    i64toi32_i32$1 = -1;
    $3_1 = i64toi32_i32$5 >>> 0 > i64toi32_i32$3 >>> 0 | ((i64toi32_i32$5 | 0) == (i64toi32_i32$3 | 0) & i64toi32_i32$2 >>> 0 > i64toi32_i32$1 >>> 0 | 0) | 0;
    i64toi32_i32$2 = $2$hi;
    $0_1 = $2_1;
    $0$hi = i64toi32_i32$2;
    if ($3_1) {
     continue label
    }
    break label;
   };
  }
  block2 : {
   i64toi32_i32$2 = $2$hi;
   if (!($2_1 | i64toi32_i32$2 | 0)) {
    break block2
   }
   $3_1 = $2_1;
   label1 : while (1) {
    $1_1 = $1_1 + -1 | 0;
    $4_1 = ($3_1 >>> 0) / (10 >>> 0) | 0;
    $96($1_1 | 0, 0 | 0, $3_1 - Math_imul($4_1, 10) | 0 | 48 | 0 | 0);
    $5_1 = $3_1 >>> 0 > 9 >>> 0;
    $3_1 = $4_1;
    if ($5_1) {
     continue label1
    }
    break label1;
   };
  }
  return $1_1 | 0;
 }
 
 function $29($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var $5_1 = 0;
  $5_1 = global$0 - 256 | 0;
  global$0 = $5_1;
  block : {
   if (($2_1 | 0) <= ($3_1 | 0)) {
    break block
   }
   if ($4_1 & 73728 | 0) {
    break block
   }
   $3_1 = $2_1 - $3_1 | 0;
   $2_1 = $3_1 >>> 0 < 256 >>> 0;
   $7($5_1 | 0, $1_1 | 0, ($2_1 ? $3_1 : 256) | 0) | 0;
   block1 : {
    if ($2_1) {
     break block1
    }
    label : while (1) {
     $23($0_1 | 0, $5_1 | 0, 256 | 0);
     $3_1 = $3_1 + -256 | 0;
     if ($3_1 >>> 0 > 255 >>> 0) {
      continue label
     }
     break label;
    };
   }
   $23($0_1 | 0, $5_1 | 0, $3_1 | 0);
  }
  global$0 = $5_1 + 256 | 0;
 }
 
 function $30($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  return $21($0_1 | 0, $1_1 | 0, $2_1 | 0, 4 | 0, 5 | 0) | 0 | 0;
 }
 
 function $31($0_1, $1_1, $2_1, $3_1, $4_1, $5_1) {
  $0_1 = $0_1 | 0;
  $1_1 = +$1_1;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  $5_1 = $5_1 | 0;
  var $10_1 = 0, $11_1 = 0, $18_1 = 0, $19_1 = 0, $12_1 = 0, i64toi32_i32$1 = 0, $15_1 = 0, $6_1 = 0, i64toi32_i32$4 = 0, i64toi32_i32$5 = 0, i64toi32_i32$0 = 0, $22_1 = 0, i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, $23_1 = 0, $20_1 = 0, $17_1 = 0, $8_1 = 0, $27_1 = 0.0, $13_1 = 0, $24_1 = 0, $14_1 = 0, $16_1 = 0, $24$hi = 0, $9_1 = 0, $21_1 = 0, $7_1 = 0, $44_1 = 0, $45_1 = 0, $46_1 = 0, $25$hi = 0, $47_1 = 0, $25_1 = 0, $168 = 0, $170$hi = 0, $172$hi = 0, $174 = 0, $174$hi = 0, $26$hi = 0, $180 = 0, $180$hi = 0, $388 = 0.0;
  $6_1 = global$0 - 560 | 0;
  global$0 = $6_1;
  $7_1 = 0;
  $101($6_1 | 0, 44 | 0, 0 | 0);
  block1 : {
   block : {
    i64toi32_i32$0 = $33(+$1_1) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $24_1 = i64toi32_i32$0;
    $24$hi = i64toi32_i32$1;
    i64toi32_i32$2 = i64toi32_i32$0;
    i64toi32_i32$0 = -1;
    i64toi32_i32$3 = -1;
    if ((i64toi32_i32$1 | 0) > (i64toi32_i32$0 | 0)) {
     $44_1 = 1
    } else {
     if ((i64toi32_i32$1 | 0) >= (i64toi32_i32$0 | 0)) {
      if (i64toi32_i32$2 >>> 0 <= i64toi32_i32$3 >>> 0) {
       $45_1 = 0
      } else {
       $45_1 = 1
      }
      $46_1 = $45_1;
     } else {
      $46_1 = 0
     }
     $44_1 = $46_1;
    }
    if ($44_1) {
     break block
    }
    $8_1 = 1;
    $9_1 = 65546;
    $1_1 = -$1_1;
    i64toi32_i32$2 = $33(+$1_1) | 0;
    i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    $24_1 = i64toi32_i32$2;
    $24$hi = i64toi32_i32$1;
    break block1;
   }
   block2 : {
    if (!($4_1 & 2048 | 0)) {
     break block2
    }
    $8_1 = 1;
    $9_1 = 65549;
    break block1;
   }
   $8_1 = $4_1 & 1 | 0;
   $9_1 = $8_1 ? 65552 : 65547;
   $7_1 = !$8_1;
  }
  block4 : {
   block3 : {
    i64toi32_i32$1 = $24$hi;
    i64toi32_i32$3 = $24_1;
    i64toi32_i32$2 = 2146435072;
    i64toi32_i32$0 = 0;
    i64toi32_i32$2 = i64toi32_i32$1 & i64toi32_i32$2 | 0;
    i64toi32_i32$1 = i64toi32_i32$3 & i64toi32_i32$0 | 0;
    i64toi32_i32$3 = 2146435072;
    i64toi32_i32$0 = 0;
    if ((i64toi32_i32$1 | 0) != (i64toi32_i32$0 | 0) | (i64toi32_i32$2 | 0) != (i64toi32_i32$3 | 0) | 0) {
     break block3
    }
    $10_1 = $8_1 + 3 | 0;
    $29($0_1 | 0, 32 | 0, $2_1 | 0, $10_1 | 0, $4_1 & -65537 | 0 | 0);
    $23($0_1 | 0, $9_1 | 0, $8_1 | 0);
    $11_1 = $5_1 & 32 | 0;
    $23($0_1 | 0, ($1_1 != $1_1 ? ($11_1 ? 65565 : 65573) : $11_1 ? 65569 : 65577) | 0, 3 | 0);
    $29($0_1 | 0, 32 | 0, $2_1 | 0, $10_1 | 0, $4_1 ^ 8192 | 0 | 0);
    $12_1 = ($2_1 | 0) > ($10_1 | 0) ? $2_1 : $10_1;
    break block4;
   }
   $13_1 = $6_1 + 16 | 0;
   block7 : {
    block8 : {
     block6 : {
      block5 : {
       $1_1 = +$18(+$1_1, $6_1 + 44 | 0 | 0);
       $1_1 = $1_1 + $1_1;
       if ($1_1 == 0.0) {
        break block5
       }
       $10_1 = $72($6_1 | 0, 44 | 0) | 0;
       $101($6_1 | 0, 44 | 0, $10_1 + -1 | 0 | 0);
       $14_1 = $5_1 | 32 | 0;
       if (($14_1 | 0) != (97 | 0)) {
        break block6
       }
       break block7;
      }
      $14_1 = $5_1 | 32 | 0;
      if (($14_1 | 0) == (97 | 0)) {
       break block7
      }
      $15_1 = ($3_1 | 0) < (0 | 0) ? 6 : $3_1;
      $16_1 = $72($6_1 | 0, 44 | 0) | 0;
      break block8;
     }
     $16_1 = $10_1 + -29 | 0;
     $101($6_1 | 0, 44 | 0, $16_1 | 0);
     $15_1 = ($3_1 | 0) < (0 | 0) ? 6 : $3_1;
     $1_1 = $1_1 * 268435456.0;
    }
    $17_1 = ($6_1 + 48 | 0) + (($16_1 | 0) < (0 | 0) ? 0 : 288) | 0;
    $11_1 = $17_1;
    label : while (1) {
     block10 : {
      block9 : {
       if (!($1_1 < 4294967296.0 & $1_1 >= 0.0 | 0)) {
        break block9
       }
       $10_1 = ~~$1_1 >>> 0;
       break block10;
      }
      $10_1 = 0;
     }
     $101($11_1 | 0, 0 | 0, $10_1 | 0);
     $11_1 = $11_1 + 4 | 0;
     $1_1 = ($1_1 - +($10_1 >>> 0)) * 1.0e9;
     if ($1_1 != 0.0) {
      continue label
     }
     break label;
    };
    block12 : {
     block11 : {
      if (($16_1 | 0) >= (1 | 0)) {
       break block11
      }
      $18_1 = $16_1;
      $10_1 = $11_1;
      $19_1 = $17_1;
      break block12;
     }
     $19_1 = $17_1;
     $18_1 = $16_1;
     label3 : while (1) {
      $18_1 = $18_1 >>> 0 < 29 >>> 0 ? $18_1 : 29;
      block13 : {
       $10_1 = $11_1 + -4 | 0;
       if ($10_1 >>> 0 < $19_1 >>> 0) {
        break block13
       }
       i64toi32_i32$1 = 0;
       $25_1 = $18_1;
       $25$hi = i64toi32_i32$1;
       i64toi32_i32$1 = 0;
       $24_1 = 0;
       $24$hi = i64toi32_i32$1;
       label1 : while (1) {
        $168 = $10_1;
        i64toi32_i32$1 = $84($10_1 | 0, 0 | 0) | 0;
        i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
        $170$hi = i64toi32_i32$2;
        i64toi32_i32$2 = $25$hi;
        i64toi32_i32$2 = $170$hi;
        i64toi32_i32$0 = i64toi32_i32$1;
        i64toi32_i32$1 = $25$hi;
        i64toi32_i32$3 = $25_1;
        i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
        if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
         i64toi32_i32$1 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
         $47_1 = 0;
        } else {
         i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$4 | 0) | 0;
         $47_1 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
        }
        $172$hi = i64toi32_i32$1;
        i64toi32_i32$1 = $24$hi;
        i64toi32_i32$2 = $24_1;
        i64toi32_i32$0 = 0;
        i64toi32_i32$3 = -1;
        i64toi32_i32$0 = i64toi32_i32$1 & i64toi32_i32$0 | 0;
        $174 = i64toi32_i32$2 & i64toi32_i32$3 | 0;
        $174$hi = i64toi32_i32$0;
        i64toi32_i32$0 = $172$hi;
        i64toi32_i32$1 = $47_1;
        i64toi32_i32$2 = $174$hi;
        i64toi32_i32$3 = $174;
        i64toi32_i32$4 = i64toi32_i32$1 + i64toi32_i32$3 | 0;
        i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$2 | 0;
        if (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) {
         i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
        }
        $26$hi = i64toi32_i32$5;
        i64toi32_i32$1 = 0;
        i64toi32_i32$1 = __wasm_i64_udiv(i64toi32_i32$4 | 0, i64toi32_i32$5 | 0, 1e9 | 0, i64toi32_i32$1 | 0) | 0;
        i64toi32_i32$5 = i64toi32_i32$HIGH_BITS;
        $24_1 = i64toi32_i32$1;
        $24$hi = i64toi32_i32$5;
        i64toi32_i32$1 = 0;
        i64toi32_i32$1 = __wasm_i64_mul($24_1 | 0, i64toi32_i32$5 | 0, 1e9 | 0, i64toi32_i32$1 | 0) | 0;
        i64toi32_i32$5 = i64toi32_i32$HIGH_BITS;
        $180 = i64toi32_i32$1;
        $180$hi = i64toi32_i32$5;
        i64toi32_i32$5 = $26$hi;
        i64toi32_i32$0 = i64toi32_i32$4;
        i64toi32_i32$1 = $180$hi;
        i64toi32_i32$3 = $180;
        i64toi32_i32$2 = i64toi32_i32$4 - i64toi32_i32$3 | 0;
        i64toi32_i32$4 = (i64toi32_i32$4 >>> 0 < i64toi32_i32$3 >>> 0) + i64toi32_i32$1 | 0;
        i64toi32_i32$4 = i64toi32_i32$5 - i64toi32_i32$4 | 0;
        $107($168 | 0, 0 | 0, i64toi32_i32$2 | 0, i64toi32_i32$4 | 0);
        $10_1 = $10_1 + -4 | 0;
        if ($10_1 >>> 0 >= $19_1 >>> 0) {
         continue label1
        }
        break label1;
       };
       i64toi32_i32$4 = i64toi32_i32$5;
       i64toi32_i32$4 = i64toi32_i32$5;
       i64toi32_i32$5 = i64toi32_i32$0;
       i64toi32_i32$0 = 0;
       i64toi32_i32$3 = 1e9;
       if (i64toi32_i32$4 >>> 0 < i64toi32_i32$0 >>> 0 | ((i64toi32_i32$4 | 0) == (i64toi32_i32$0 | 0) & i64toi32_i32$5 >>> 0 < i64toi32_i32$3 >>> 0 | 0) | 0) {
        break block13
       }
       $19_1 = $19_1 + -4 | 0;
       i64toi32_i32$5 = $24$hi;
       $107($19_1 | 0, 0 | 0, $24_1 | 0, i64toi32_i32$5 | 0);
      }
      block14 : {
       label2 : while (1) {
        $10_1 = $11_1;
        if ($10_1 >>> 0 <= $19_1 >>> 0) {
         break block14
        }
        $11_1 = $10_1 + -4 | 0;
        if (!($72($11_1 | 0, 0 | 0) | 0)) {
         continue label2
        }
        break label2;
       };
      }
      $18_1 = ($72($6_1 | 0, 44 | 0) | 0) - $18_1 | 0;
      $101($6_1 | 0, 44 | 0, $18_1 | 0);
      $11_1 = $10_1;
      if (($18_1 | 0) > (0 | 0)) {
       continue label3
      }
      break label3;
     };
    }
    block15 : {
     if (($18_1 | 0) > (-1 | 0)) {
      break block15
     }
     $20_1 = ((($15_1 + 25 | 0) >>> 0) / (9 >>> 0) | 0) + 1 | 0;
     $21_1 = ($14_1 | 0) == (102 | 0);
     label5 : while (1) {
      $11_1 = 0 - $18_1 | 0;
      $12_1 = $11_1 >>> 0 < 9 >>> 0 ? $11_1 : 9;
      block17 : {
       block16 : {
        if ($19_1 >>> 0 < $10_1 >>> 0) {
         break block16
        }
        $11_1 = !($72($19_1 | 0, 0 | 0) | 0) << 2 | 0;
        break block17;
       }
       $22_1 = 1e9 >>> $12_1 | 0;
       $23_1 = (-1 << $12_1 | 0) ^ -1 | 0;
       $18_1 = 0;
       $11_1 = $19_1;
       label4 : while (1) {
        $3_1 = $72($11_1 | 0, 0 | 0) | 0;
        $101($11_1 | 0, 0 | 0, ($3_1 >>> $12_1 | 0) + $18_1 | 0 | 0);
        $18_1 = Math_imul($3_1 & $23_1 | 0, $22_1);
        $11_1 = $11_1 + 4 | 0;
        if ($11_1 >>> 0 < $10_1 >>> 0) {
         continue label4
        }
        break label4;
       };
       $11_1 = !($72($19_1 | 0, 0 | 0) | 0) << 2 | 0;
       if (!$18_1) {
        break block17
       }
       $101($10_1 | 0, 0 | 0, $18_1 | 0);
       $10_1 = $10_1 + 4 | 0;
      }
      $18_1 = ($72($6_1 | 0, 44 | 0) | 0) + $12_1 | 0;
      $101($6_1 | 0, 44 | 0, $18_1 | 0);
      $19_1 = $19_1 + $11_1 | 0;
      $11_1 = $21_1 ? $17_1 : $19_1;
      $10_1 = (($10_1 - $11_1 | 0) >> 2 | 0 | 0) > ($20_1 | 0) ? $11_1 + ($20_1 << 2 | 0) | 0 : $10_1;
      if (($18_1 | 0) < (0 | 0)) {
       continue label5
      }
      break label5;
     };
    }
    $18_1 = 0;
    block18 : {
     if ($19_1 >>> 0 >= $10_1 >>> 0) {
      break block18
     }
     $18_1 = Math_imul(($17_1 - $19_1 | 0) >> 2 | 0, 9);
     $11_1 = 10;
     $3_1 = $72($19_1 | 0, 0 | 0) | 0;
     if ($3_1 >>> 0 < 10 >>> 0) {
      break block18
     }
     label6 : while (1) {
      $18_1 = $18_1 + 1 | 0;
      $11_1 = Math_imul($11_1, 10);
      if ($3_1 >>> 0 >= $11_1 >>> 0) {
       continue label6
      }
      break label6;
     };
    }
    block19 : {
     $11_1 = ($15_1 - (($14_1 | 0) == (102 | 0) ? 0 : $18_1) | 0) - (($15_1 | 0) != (0 | 0) & ($14_1 | 0) == (103 | 0) | 0) | 0;
     if (($11_1 | 0) >= (Math_imul(($10_1 - $17_1 | 0) >> 2 | 0, 9) + -9 | 0 | 0)) {
      break block19
     }
     $3_1 = $11_1 + 9216 | 0;
     $22_1 = ($3_1 | 0) / (9 | 0) | 0;
     $12_1 = (($6_1 + 48 | 0) + (($16_1 | 0) < (0 | 0) ? -4092 : -3804) | 0) + ($22_1 << 2 | 0) | 0;
     $11_1 = 10;
     block20 : {
      $3_1 = $3_1 - Math_imul($22_1, 9) | 0;
      if (($3_1 | 0) > (7 | 0)) {
       break block20
      }
      label7 : while (1) {
       $11_1 = Math_imul($11_1, 10);
       $3_1 = $3_1 + 1 | 0;
       if (($3_1 | 0) != (8 | 0)) {
        continue label7
       }
       break label7;
      };
     }
     $23_1 = $12_1 + 4 | 0;
     block22 : {
      block21 : {
       $3_1 = $72($12_1 | 0, 0 | 0) | 0;
       $20_1 = ($3_1 >>> 0) / ($11_1 >>> 0) | 0;
       $22_1 = $3_1 - Math_imul($20_1, $11_1) | 0;
       if ($22_1) {
        break block21
       }
       if (($23_1 | 0) == ($10_1 | 0)) {
        break block22
       }
      }
      block24 : {
       block23 : {
        if ($20_1 & 1 | 0) {
         break block23
        }
        $1_1 = 9007199254740992.0;
        if (($11_1 | 0) != (1e9 | 0)) {
         break block24
        }
        if ($12_1 >>> 0 <= $19_1 >>> 0) {
         break block24
        }
        if (!(($65($12_1 + -4 | 0 | 0, 0 | 0) | 0) & 1 | 0)) {
         break block24
        }
       }
       $1_1 = 9007199254740994.0;
      }
      $388 = ($23_1 | 0) == ($10_1 | 0) ? 1.0 : 1.5;
      $23_1 = $11_1 >>> 1 | 0;
      $27_1 = $22_1 >>> 0 < $23_1 >>> 0 ? .5 : ($22_1 | 0) == ($23_1 | 0) ? $388 : 1.5;
      block25 : {
       if ($7_1) {
        break block25
       }
       if (($65($9_1 | 0, 0 | 0) | 0 | 0) != (45 | 0)) {
        break block25
       }
       $27_1 = -$27_1;
       $1_1 = -$1_1;
      }
      $3_1 = $3_1 - $22_1 | 0;
      $101($12_1 | 0, 0 | 0, $3_1 | 0);
      if ($1_1 + $27_1 == $1_1) {
       break block22
      }
      $11_1 = $3_1 + $11_1 | 0;
      $101($12_1 | 0, 0 | 0, $11_1 | 0);
      block26 : {
       if ($11_1 >>> 0 < 1e9 >>> 0) {
        break block26
       }
       label8 : while (1) {
        $101($12_1 | 0, 0 | 0, 0 | 0);
        block27 : {
         $12_1 = $12_1 + -4 | 0;
         if ($12_1 >>> 0 >= $19_1 >>> 0) {
          break block27
         }
         $19_1 = $19_1 + -4 | 0;
         $101($19_1 | 0, 0 | 0, 0 | 0);
        }
        $11_1 = ($72($12_1 | 0, 0 | 0) | 0) + 1 | 0;
        $101($12_1 | 0, 0 | 0, $11_1 | 0);
        if ($11_1 >>> 0 > 999999999 >>> 0) {
         continue label8
        }
        break label8;
       };
      }
      $18_1 = Math_imul(($17_1 - $19_1 | 0) >> 2 | 0, 9);
      $11_1 = 10;
      $3_1 = $72($19_1 | 0, 0 | 0) | 0;
      if ($3_1 >>> 0 < 10 >>> 0) {
       break block22
      }
      label9 : while (1) {
       $18_1 = $18_1 + 1 | 0;
       $11_1 = Math_imul($11_1, 10);
       if ($3_1 >>> 0 >= $11_1 >>> 0) {
        continue label9
       }
       break label9;
      };
     }
     $11_1 = $12_1 + 4 | 0;
     $10_1 = $10_1 >>> 0 > $11_1 >>> 0 ? $11_1 : $10_1;
    }
    block28 : {
     label10 : while (1) {
      $11_1 = $10_1;
      $3_1 = $10_1 >>> 0 <= $19_1 >>> 0;
      if ($3_1) {
       break block28
      }
      $10_1 = $10_1 + -4 | 0;
      if (!($72($10_1 | 0, 0 | 0) | 0)) {
       continue label10
      }
      break label10;
     };
    }
    block30 : {
     block29 : {
      if (($14_1 | 0) == (103 | 0)) {
       break block29
      }
      $22_1 = $4_1 & 8 | 0;
      break block30;
     }
     $10_1 = $15_1 ? $15_1 : 1;
     $12_1 = ($10_1 | 0) > ($18_1 | 0) & ($18_1 | 0) > (-5 | 0) | 0;
     $15_1 = ($12_1 ? $18_1 ^ -1 | 0 : -1) + $10_1 | 0;
     $5_1 = ($12_1 ? -1 : -2) + $5_1 | 0;
     $22_1 = $4_1 & 8 | 0;
     if ($22_1) {
      break block30
     }
     $10_1 = -9;
     block31 : {
      if ($3_1) {
       break block31
      }
      $12_1 = $72($11_1 + -4 | 0 | 0, 0 | 0) | 0;
      if (!$12_1) {
       break block31
      }
      $3_1 = 10;
      $10_1 = 0;
      if (($12_1 >>> 0) % (10 >>> 0) | 0) {
       break block31
      }
      label11 : while (1) {
       $22_1 = $10_1;
       $10_1 = $10_1 + 1 | 0;
       $3_1 = Math_imul($3_1, 10);
       if (!(($12_1 >>> 0) % ($3_1 >>> 0) | 0)) {
        continue label11
       }
       break label11;
      };
      $10_1 = $22_1 ^ -1 | 0;
     }
     $3_1 = Math_imul(($11_1 - $17_1 | 0) >> 2 | 0, 9);
     block32 : {
      if (($5_1 & -33 | 0 | 0) != (70 | 0)) {
       break block32
      }
      $22_1 = 0;
      $10_1 = ($3_1 + $10_1 | 0) + -9 | 0;
      $10_1 = ($10_1 | 0) > (0 | 0) ? $10_1 : 0;
      $15_1 = ($15_1 | 0) < ($10_1 | 0) ? $15_1 : $10_1;
      break block30;
     }
     $22_1 = 0;
     $10_1 = (($18_1 + $3_1 | 0) + $10_1 | 0) + -9 | 0;
     $10_1 = ($10_1 | 0) > (0 | 0) ? $10_1 : 0;
     $15_1 = ($15_1 | 0) < ($10_1 | 0) ? $15_1 : $10_1;
    }
    $12_1 = -1;
    $23_1 = $15_1 | $22_1 | 0;
    if (($15_1 | 0) > (($23_1 ? 2147483645 : 2147483646) | 0)) {
     break block4
    }
    $3_1 = ($15_1 + (($23_1 | 0) != (0 | 0)) | 0) + 1 | 0;
    block34 : {
     block33 : {
      $21_1 = $5_1 & -33 | 0;
      if (($21_1 | 0) != (70 | 0)) {
       break block33
      }
      if (($18_1 | 0) > ($3_1 ^ 2147483647 | 0 | 0)) {
       break block4
      }
      $10_1 = ($18_1 | 0) > (0 | 0) ? $18_1 : 0;
      break block34;
     }
     block35 : {
      $10_1 = $18_1 >> 31 | 0;
      i64toi32_i32$5 = 0;
      $10_1 = $28(($18_1 ^ $10_1 | 0) - $10_1 | 0 | 0, i64toi32_i32$5 | 0, $13_1 | 0) | 0;
      if (($13_1 - $10_1 | 0 | 0) > (1 | 0)) {
       break block35
      }
      label12 : while (1) {
       $10_1 = $10_1 + -1 | 0;
       $96($10_1 | 0, 0 | 0, 48 | 0);
       if (($13_1 - $10_1 | 0 | 0) < (2 | 0)) {
        continue label12
       }
       break label12;
      };
     }
     $20_1 = $10_1 + -2 | 0;
     $96($20_1 | 0, 0 | 0, $5_1 | 0);
     $12_1 = -1;
     $96($10_1 + -1 | 0 | 0, 0 | 0, (($18_1 | 0) < (0 | 0) ? 45 : 43) | 0);
     $10_1 = $13_1 - $20_1 | 0;
     if (($10_1 | 0) > ($3_1 ^ 2147483647 | 0 | 0)) {
      break block4
     }
    }
    $12_1 = -1;
    $10_1 = $10_1 + $3_1 | 0;
    if (($10_1 | 0) > ($8_1 ^ 2147483647 | 0 | 0)) {
     break block4
    }
    $5_1 = $10_1 + $8_1 | 0;
    $29($0_1 | 0, 32 | 0, $2_1 | 0, $5_1 | 0, $4_1 | 0);
    $23($0_1 | 0, $9_1 | 0, $8_1 | 0);
    $29($0_1 | 0, 48 | 0, $2_1 | 0, $5_1 | 0, $4_1 ^ 65536 | 0 | 0);
    block47 : {
     block42 : {
      block40 : {
       block36 : {
        if (($21_1 | 0) != (70 | 0)) {
         break block36
        }
        $18_1 = $6_1 + 16 | 0 | 9 | 0;
        $3_1 = $19_1 >>> 0 > $17_1 >>> 0 ? $17_1 : $19_1;
        $19_1 = $3_1;
        label14 : while (1) {
         i64toi32_i32$5 = $84($19_1 | 0, 0 | 0) | 0;
         i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
         $10_1 = $28(i64toi32_i32$5 | 0, i64toi32_i32$4 | 0, $18_1 | 0) | 0;
         block38 : {
          block37 : {
           if (($19_1 | 0) == ($3_1 | 0)) {
            break block37
           }
           if ($10_1 >>> 0 <= ($6_1 + 16 | 0) >>> 0) {
            break block38
           }
           label13 : while (1) {
            $10_1 = $10_1 + -1 | 0;
            $96($10_1 | 0, 0 | 0, 48 | 0);
            if ($10_1 >>> 0 > ($6_1 + 16 | 0) >>> 0) {
             continue label13
            }
            break block38;
           };
          }
          if (($10_1 | 0) != ($18_1 | 0)) {
           break block38
          }
          $10_1 = $10_1 + -1 | 0;
          $96($10_1 | 0, 0 | 0, 48 | 0);
         }
         $23($0_1 | 0, $10_1 | 0, $18_1 - $10_1 | 0 | 0);
         $19_1 = $19_1 + 4 | 0;
         if ($19_1 >>> 0 <= $17_1 >>> 0) {
          continue label14
         }
         break label14;
        };
        block39 : {
         if (!$23_1) {
          break block39
         }
         $23($0_1 | 0, 65581 | 0, 1 | 0);
        }
        if ($19_1 >>> 0 >= $11_1 >>> 0) {
         break block40
        }
        if (($15_1 | 0) < (1 | 0)) {
         break block40
        }
        label16 : while (1) {
         block41 : {
          i64toi32_i32$4 = $84($19_1 | 0, 0 | 0) | 0;
          i64toi32_i32$5 = i64toi32_i32$HIGH_BITS;
          $10_1 = $28(i64toi32_i32$4 | 0, i64toi32_i32$5 | 0, $18_1 | 0) | 0;
          if ($10_1 >>> 0 <= ($6_1 + 16 | 0) >>> 0) {
           break block41
          }
          label15 : while (1) {
           $10_1 = $10_1 + -1 | 0;
           $96($10_1 | 0, 0 | 0, 48 | 0);
           if ($10_1 >>> 0 > ($6_1 + 16 | 0) >>> 0) {
            continue label15
           }
           break label15;
          };
         }
         $23($0_1 | 0, $10_1 | 0, (($15_1 | 0) < (9 | 0) ? $15_1 : 9) | 0);
         $10_1 = $15_1 + -9 | 0;
         $19_1 = $19_1 + 4 | 0;
         if ($19_1 >>> 0 >= $11_1 >>> 0) {
          break block42
         }
         $3_1 = ($15_1 | 0) > (9 | 0);
         $15_1 = $10_1;
         if ($3_1) {
          continue label16
         }
         break block42;
        };
       }
       block43 : {
        if (($15_1 | 0) < (0 | 0)) {
         break block43
        }
        $12_1 = $11_1 >>> 0 > $19_1 >>> 0 ? $11_1 : $19_1 + 4 | 0;
        $18_1 = $6_1 + 16 | 0 | 9 | 0;
        $11_1 = $19_1;
        label18 : while (1) {
         block44 : {
          i64toi32_i32$5 = $84($11_1 | 0, 0 | 0) | 0;
          i64toi32_i32$4 = i64toi32_i32$HIGH_BITS;
          $10_1 = $28(i64toi32_i32$5 | 0, i64toi32_i32$4 | 0, $18_1 | 0) | 0;
          if (($10_1 | 0) != ($18_1 | 0)) {
           break block44
          }
          $10_1 = $10_1 + -1 | 0;
          $96($10_1 | 0, 0 | 0, 48 | 0);
         }
         block46 : {
          block45 : {
           if (($11_1 | 0) == ($19_1 | 0)) {
            break block45
           }
           if ($10_1 >>> 0 <= ($6_1 + 16 | 0) >>> 0) {
            break block46
           }
           label17 : while (1) {
            $10_1 = $10_1 + -1 | 0;
            $96($10_1 | 0, 0 | 0, 48 | 0);
            if ($10_1 >>> 0 > ($6_1 + 16 | 0) >>> 0) {
             continue label17
            }
            break block46;
           };
          }
          $23($0_1 | 0, $10_1 | 0, 1 | 0);
          $10_1 = $10_1 + 1 | 0;
          if (!($15_1 | $22_1 | 0)) {
           break block46
          }
          $23($0_1 | 0, 65581 | 0, 1 | 0);
         }
         $3_1 = $18_1 - $10_1 | 0;
         $23($0_1 | 0, $10_1 | 0, (($15_1 | 0) > ($3_1 | 0) ? $3_1 : $15_1) | 0);
         $15_1 = $15_1 - $3_1 | 0;
         $11_1 = $11_1 + 4 | 0;
         if ($11_1 >>> 0 >= $12_1 >>> 0) {
          break block43
         }
         if (($15_1 | 0) > (-1 | 0)) {
          continue label18
         }
         break label18;
        };
       }
       $29($0_1 | 0, 48 | 0, $15_1 + 18 | 0 | 0, 18 | 0, 0 | 0);
       $23($0_1 | 0, $20_1 | 0, $13_1 - $20_1 | 0 | 0);
       break block47;
      }
      $10_1 = $15_1;
     }
     $29($0_1 | 0, 48 | 0, $10_1 + 9 | 0 | 0, 9 | 0, 0 | 0);
    }
    $29($0_1 | 0, 32 | 0, $2_1 | 0, $5_1 | 0, $4_1 ^ 8192 | 0 | 0);
    $12_1 = ($2_1 | 0) > ($5_1 | 0) ? $2_1 : $5_1;
    break block4;
   }
   $20_1 = $9_1 + ((($5_1 << 26 | 0) >> 31 | 0) & 9 | 0) | 0;
   block48 : {
    if ($3_1 >>> 0 > 11 >>> 0) {
     break block48
    }
    $10_1 = 12 - $3_1 | 0;
    $27_1 = 16.0;
    label19 : while (1) {
     $27_1 = $27_1 * 16.0;
     $10_1 = $10_1 + -1 | 0;
     if ($10_1) {
      continue label19
     }
     break label19;
    };
    block49 : {
     if (($65($20_1 | 0, 0 | 0) | 0 | 0) != (45 | 0)) {
      break block49
     }
     $1_1 = -($27_1 + (-$1_1 - $27_1));
     break block48;
    }
    $1_1 = $1_1 + $27_1 - $27_1;
   }
   block50 : {
    $11_1 = $72($6_1 | 0, 44 | 0) | 0;
    $10_1 = $11_1 >> 31 | 0;
    i64toi32_i32$4 = 0;
    $10_1 = $28(($11_1 ^ $10_1 | 0) - $10_1 | 0 | 0, i64toi32_i32$4 | 0, $13_1 | 0) | 0;
    if (($10_1 | 0) != ($13_1 | 0)) {
     break block50
    }
    $10_1 = $10_1 + -1 | 0;
    $96($10_1 | 0, 0 | 0, 48 | 0);
    $11_1 = $72($6_1 | 0, 44 | 0) | 0;
   }
   $22_1 = $8_1 | 2 | 0;
   $19_1 = $5_1 & 32 | 0;
   $23_1 = $10_1 + -2 | 0;
   $96($23_1 | 0, 0 | 0, $5_1 + 15 | 0 | 0);
   $96($10_1 + -1 | 0 | 0, 0 | 0, (($11_1 | 0) < (0 | 0) ? 45 : 43) | 0);
   $18_1 = ($3_1 | 0) < (1 | 0) & !($4_1 & 8 | 0) | 0;
   $11_1 = $6_1 + 16 | 0;
   label20 : while (1) {
    $10_1 = $11_1;
    block52 : {
     block51 : {
      if (!(Math_abs($1_1) < 2147483648.0)) {
       break block51
      }
      $11_1 = ~~$1_1;
      break block52;
     }
     $11_1 = -2147483648;
    }
    $96($10_1 | 0, 0 | 0, $65($11_1 + 66096 | 0 | 0, 0 | 0) | 0 | $19_1 | 0 | 0);
    $1_1 = ($1_1 - +($11_1 | 0)) * 16.0;
    block53 : {
     $11_1 = $10_1 + 1 | 0;
     if (($11_1 - ($6_1 + 16 | 0) | 0 | 0) != (1 | 0)) {
      break block53
     }
     if ($1_1 == 0.0 & $18_1 | 0) {
      break block53
     }
     $96($10_1 | 0, 1 | 0, 46 | 0);
     $11_1 = $10_1 + 2 | 0;
    }
    if ($1_1 != 0.0) {
     continue label20
    }
    break label20;
   };
   $12_1 = -1;
   $19_1 = $13_1 - $23_1 | 0;
   $18_1 = $22_1 + $19_1 | 0;
   if (($3_1 | 0) > (2147483645 - $18_1 | 0 | 0)) {
    break block4
   }
   $10_1 = $11_1 - ($6_1 + 16 | 0) | 0;
   $3_1 = $3_1 ? (($10_1 + -2 | 0 | 0) < ($3_1 | 0) ? $3_1 + 2 | 0 : $10_1) : $10_1;
   $11_1 = $18_1 + $3_1 | 0;
   $29($0_1 | 0, 32 | 0, $2_1 | 0, $11_1 | 0, $4_1 | 0);
   $23($0_1 | 0, $20_1 | 0, $22_1 | 0);
   $29($0_1 | 0, 48 | 0, $2_1 | 0, $11_1 | 0, $4_1 ^ 65536 | 0 | 0);
   $23($0_1 | 0, $6_1 + 16 | 0 | 0, $10_1 | 0);
   $29($0_1 | 0, 48 | 0, $3_1 - $10_1 | 0 | 0, 0 | 0, 0 | 0);
   $23($0_1 | 0, $23_1 | 0, $19_1 | 0);
   $29($0_1 | 0, 32 | 0, $2_1 | 0, $11_1 | 0, $4_1 ^ 8192 | 0 | 0);
   $12_1 = ($2_1 | 0) > ($11_1 | 0) ? $2_1 : $11_1;
  }
  global$0 = $6_1 + 560 | 0;
  return $12_1 | 0;
 }
 
 function $32($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, $2_1 = 0, $12_1 = 0, $12$hi = 0, $15_1 = 0, $15$hi = 0;
  $2_1 = (($72($1_1 | 0, 0 | 0) | 0) + 7 | 0) & -8 | 0;
  $101($1_1 | 0, 0 | 0, $2_1 + 16 | 0 | 0);
  i64toi32_i32$0 = $88($2_1 | 0, 0 | 0) | 0;
  i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  $12_1 = i64toi32_i32$0;
  $12$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $88($2_1 + 8 | 0 | 0, 0 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  $15_1 = i64toi32_i32$1;
  $15$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $12$hi;
  i64toi32_i32$1 = $15$hi;
  $118($0_1 | 0, 0 | 0, +(+$49($12_1 | 0, i64toi32_i32$0 | 0, $15_1 | 0, i64toi32_i32$1 | 0)));
 }
 
 function $33($0_1) {
  $0_1 = +$0_1;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  wasm2js_scratch_store_f64(+$0_1);
  i64toi32_i32$0 = wasm2js_scratch_load_i32(1 | 0) | 0;
  i64toi32_i32$1 = wasm2js_scratch_load_i32(0 | 0) | 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$0;
  return i64toi32_i32$1 | 0;
 }
 
 function $34($0_1) {
  $0_1 = $0_1 | 0;
  block : {
   if ($0_1) {
    break block
   }
   return 0 | 0;
  }
  $101($17() | 0 | 0, 0 | 0, $0_1 | 0);
  return -1 | 0;
 }
 
 function $35() {
  return 42 | 0;
 }
 
 function $36() {
  return $35() | 0 | 0;
 }
 
 function $37() {
  return 69600 | 0;
 }
 
 function $38() {
  $101(0 | 0, 69696 | 0, 69576 | 0);
  $101(0 | 0, 69624 | 0, $36() | 0 | 0);
 }
 
 function $39($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0;
  $3_1 = 1;
  block1 : {
   block : {
    if (!$0_1) {
     break block
    }
    if ($1_1 >>> 0 <= 127 >>> 0) {
     break block1
    }
    block3 : {
     block2 : {
      if ($72($72($37() | 0 | 0, 96 | 0) | 0 | 0, 0 | 0) | 0) {
       break block2
      }
      if (($1_1 & -128 | 0 | 0) == (57216 | 0)) {
       break block1
      }
      $101($17() | 0 | 0, 0 | 0, 25 | 0);
      break block3;
     }
     block4 : {
      if ($1_1 >>> 0 > 2047 >>> 0) {
       break block4
      }
      $96($0_1 | 0, 1 | 0, $1_1 & 63 | 0 | 128 | 0 | 0);
      $96($0_1 | 0, 0 | 0, $1_1 >>> 6 | 0 | 192 | 0 | 0);
      return 2 | 0;
     }
     block6 : {
      block5 : {
       if ($1_1 >>> 0 < 55296 >>> 0) {
        break block5
       }
       if (($1_1 & -8192 | 0 | 0) != (57344 | 0)) {
        break block6
       }
      }
      $96($0_1 | 0, 2 | 0, $1_1 & 63 | 0 | 128 | 0 | 0);
      $96($0_1 | 0, 0 | 0, $1_1 >>> 12 | 0 | 224 | 0 | 0);
      $96($0_1 | 0, 1 | 0, ($1_1 >>> 6 | 0) & 63 | 0 | 128 | 0 | 0);
      return 3 | 0;
     }
     block7 : {
      if (($1_1 + -65536 | 0) >>> 0 > 1048575 >>> 0) {
       break block7
      }
      $96($0_1 | 0, 3 | 0, $1_1 & 63 | 0 | 128 | 0 | 0);
      $96($0_1 | 0, 0 | 0, $1_1 >>> 18 | 0 | 240 | 0 | 0);
      $96($0_1 | 0, 2 | 0, ($1_1 >>> 6 | 0) & 63 | 0 | 128 | 0 | 0);
      $96($0_1 | 0, 1 | 0, ($1_1 >>> 12 | 0) & 63 | 0 | 128 | 0 | 0);
      return 4 | 0;
     }
     $101($17() | 0 | 0, 0 | 0, 25 | 0);
    }
    $3_1 = -1;
   }
   return $3_1 | 0;
  }
  $96($0_1 | 0, 0 | 0, $1_1 | 0);
  return 1 | 0;
 }
 
 function $40($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  block : {
   if ($0_1) {
    break block
   }
   return 0 | 0;
  }
  return $39($0_1 | 0, $1_1 | 0, 0 | 0) | 0 | 0;
 }
 
 function $41($0_1) {
  $0_1 = $0_1 | 0;
  var $5_1 = 0, $4_1 = 0, $7_1 = 0, $8_1 = 0, $3_1 = 0, $2_1 = 0, $6_1 = 0, $10_1 = 0, $11_1 = 0, i64toi32_i32$0 = 0, $1_1 = 0, $9_1 = 0, i64toi32_i32$1 = 0, $79 = 0, $183 = 0;
  $1_1 = global$0 - 16 | 0;
  global$0 = $1_1;
  block4 : {
   block15 : {
    block28 : {
     block61 : {
      block50 : {
       block57 : {
        block54 : {
         block31 : {
          block18 : {
           block5 : {
            block : {
             if ($0_1 >>> 0 > 244 >>> 0) {
              break block
             }
             block1 : {
              $2_1 = $72(0 | 0, 69732 | 0) | 0;
              $3_1 = $0_1 >>> 0 < 11 >>> 0 ? 16 : ($0_1 + 11 | 0) & 504 | 0;
              $4_1 = $3_1 >>> 3 | 0;
              $0_1 = $2_1 >>> $4_1 | 0;
              if (!($0_1 & 3 | 0)) {
               break block1
              }
              block3 : {
               block2 : {
                $3_1 = (($0_1 ^ -1 | 0) & 1 | 0) + $4_1 | 0;
                $4_1 = $3_1 << 3 | 0;
                $0_1 = $4_1 + 69772 | 0;
                $4_1 = $72($4_1 + 69780 | 0 | 0, 0 | 0) | 0;
                $5_1 = $72($4_1 | 0, 8 | 0) | 0;
                if (($0_1 | 0) != ($5_1 | 0)) {
                 break block2
                }
                $101(0 | 0, 69732 | 0, $2_1 & (__wasm_rotl_i32(-2 | 0, $3_1 | 0) | 0) | 0 | 0);
                break block3;
               }
               $101($5_1 | 0, 12 | 0, $0_1 | 0);
               $101($0_1 | 0, 8 | 0, $5_1 | 0);
              }
              $0_1 = $4_1 + 8 | 0;
              $3_1 = $3_1 << 3 | 0;
              $101($4_1 | 0, 4 | 0, $3_1 | 3 | 0 | 0);
              $4_1 = $4_1 + $3_1 | 0;
              $101($4_1 | 0, 4 | 0, $72($4_1 | 0, 4 | 0) | 0 | 1 | 0 | 0);
              break block4;
             }
             $6_1 = $72(0 | 0, 69740 | 0) | 0;
             if ($3_1 >>> 0 <= $6_1 >>> 0) {
              break block5
             }
             block6 : {
              if (!$0_1) {
               break block6
              }
              block8 : {
               block7 : {
                $79 = $0_1 << $4_1 | 0;
                $0_1 = 2 << $4_1 | 0;
                $4_1 = __wasm_ctz_i32($79 & ($0_1 | (0 - $0_1 | 0) | 0) | 0 | 0) | 0;
                $0_1 = $4_1 << 3 | 0;
                $5_1 = $0_1 + 69772 | 0;
                $0_1 = $72($0_1 + 69780 | 0 | 0, 0 | 0) | 0;
                $7_1 = $72($0_1 | 0, 8 | 0) | 0;
                if (($5_1 | 0) != ($7_1 | 0)) {
                 break block7
                }
                $2_1 = $2_1 & (__wasm_rotl_i32(-2 | 0, $4_1 | 0) | 0) | 0;
                $101(0 | 0, 69732 | 0, $2_1 | 0);
                break block8;
               }
               $101($7_1 | 0, 12 | 0, $5_1 | 0);
               $101($5_1 | 0, 8 | 0, $7_1 | 0);
              }
              $101($0_1 | 0, 4 | 0, $3_1 | 3 | 0 | 0);
              $7_1 = $0_1 + $3_1 | 0;
              $4_1 = $4_1 << 3 | 0;
              $3_1 = $4_1 - $3_1 | 0;
              $101($7_1 | 0, 4 | 0, $3_1 | 1 | 0 | 0);
              $101($0_1 + $4_1 | 0 | 0, 0 | 0, $3_1 | 0);
              block9 : {
               if (!$6_1) {
                break block9
               }
               $5_1 = ($6_1 & -8 | 0) + 69772 | 0;
               $4_1 = $72(0 | 0, 69752 | 0) | 0;
               block11 : {
                block10 : {
                 $8_1 = 1 << ($6_1 >>> 3 | 0) | 0;
                 if ($2_1 & $8_1 | 0) {
                  break block10
                 }
                 $101(0 | 0, 69732 | 0, $2_1 | $8_1 | 0 | 0);
                 $8_1 = $5_1;
                 break block11;
                }
                $8_1 = $72($5_1 | 0, 8 | 0) | 0;
               }
               $101($5_1 | 0, 8 | 0, $4_1 | 0);
               $101($8_1 | 0, 12 | 0, $4_1 | 0);
               $101($4_1 | 0, 12 | 0, $5_1 | 0);
               $101($4_1 | 0, 8 | 0, $8_1 | 0);
              }
              $0_1 = $0_1 + 8 | 0;
              $101(0 | 0, 69752 | 0, $7_1 | 0);
              $101(0 | 0, 69740 | 0, $3_1 | 0);
              break block4;
             }
             $9_1 = $72(0 | 0, 69736 | 0) | 0;
             if (!$9_1) {
              break block5
             }
             $7_1 = $72(((__wasm_ctz_i32($9_1 | 0) | 0) << 2 | 0) + 70036 | 0 | 0, 0 | 0) | 0;
             $4_1 = (($72($7_1 | 0, 4 | 0) | 0) & -8 | 0) - $3_1 | 0;
             $5_1 = $7_1;
             block13 : {
              label : while (1) {
               block12 : {
                $0_1 = $72($5_1 | 0, 16 | 0) | 0;
                if ($0_1) {
                 break block12
                }
                $0_1 = $72($5_1 | 0, 20 | 0) | 0;
                if (!$0_1) {
                 break block13
                }
               }
               $5_1 = (($72($0_1 | 0, 4 | 0) | 0) & -8 | 0) - $3_1 | 0;
               $183 = $5_1;
               $5_1 = $5_1 >>> 0 < $4_1 >>> 0;
               $4_1 = $5_1 ? $183 : $4_1;
               $7_1 = $5_1 ? $0_1 : $7_1;
               $5_1 = $0_1;
               continue label;
              };
             }
             $10_1 = $72($7_1 | 0, 24 | 0) | 0;
             block14 : {
              $0_1 = $72($7_1 | 0, 12 | 0) | 0;
              if (($0_1 | 0) == ($7_1 | 0)) {
               break block14
              }
              $5_1 = $72($7_1 | 0, 8 | 0) | 0;
              $101($5_1 | 0, 12 | 0, $0_1 | 0);
              $101($0_1 | 0, 8 | 0, $5_1 | 0);
              break block15;
             }
             block17 : {
              block16 : {
               $5_1 = $72($7_1 | 0, 20 | 0) | 0;
               if (!$5_1) {
                break block16
               }
               $8_1 = $7_1 + 20 | 0;
               break block17;
              }
              $5_1 = $72($7_1 | 0, 16 | 0) | 0;
              if (!$5_1) {
               break block18
              }
              $8_1 = $7_1 + 16 | 0;
             }
             label1 : while (1) {
              $11_1 = $8_1;
              $0_1 = $5_1;
              $8_1 = $0_1 + 20 | 0;
              $5_1 = $72($0_1 | 0, 20 | 0) | 0;
              if ($5_1) {
               continue label1
              }
              $8_1 = $0_1 + 16 | 0;
              $5_1 = $72($0_1 | 0, 16 | 0) | 0;
              if ($5_1) {
               continue label1
              }
              break label1;
             };
             $101($11_1 | 0, 0 | 0, 0 | 0);
             break block15;
            }
            $3_1 = -1;
            if ($0_1 >>> 0 > -65 >>> 0) {
             break block5
            }
            $4_1 = $0_1 + 11 | 0;
            $3_1 = $4_1 & -8 | 0;
            $10_1 = $72(0 | 0, 69736 | 0) | 0;
            if (!$10_1) {
             break block5
            }
            $6_1 = 31;
            block19 : {
             if ($0_1 >>> 0 > 16777204 >>> 0) {
              break block19
             }
             $0_1 = Math_clz32($4_1 >>> 8 | 0);
             $6_1 = ((($3_1 >>> (38 - $0_1 | 0) | 0) & 1 | 0) - ($0_1 << 1 | 0) | 0) + 62 | 0;
            }
            $4_1 = 0 - $3_1 | 0;
            block25 : {
             block23 : {
              block21 : {
               block20 : {
                $5_1 = $72(($6_1 << 2 | 0) + 70036 | 0 | 0, 0 | 0) | 0;
                if ($5_1) {
                 break block20
                }
                $0_1 = 0;
                $8_1 = 0;
                break block21;
               }
               $0_1 = 0;
               $7_1 = $3_1 << (($6_1 | 0) == (31 | 0) ? 0 : 25 - ($6_1 >>> 1 | 0) | 0) | 0;
               $8_1 = 0;
               label2 : while (1) {
                block22 : {
                 $2_1 = (($72($5_1 | 0, 4 | 0) | 0) & -8 | 0) - $3_1 | 0;
                 if ($2_1 >>> 0 >= $4_1 >>> 0) {
                  break block22
                 }
                 $4_1 = $2_1;
                 $8_1 = $5_1;
                 if ($4_1) {
                  break block22
                 }
                 $4_1 = 0;
                 $8_1 = $5_1;
                 $0_1 = $5_1;
                 break block23;
                }
                $2_1 = $72($5_1 | 0, 20 | 0) | 0;
                $11_1 = $72($5_1 + (($7_1 >>> 29 | 0) & 4 | 0) | 0 | 0, 16 | 0) | 0;
                $0_1 = $2_1 ? (($2_1 | 0) == ($11_1 | 0) ? $0_1 : $2_1) : $0_1;
                $7_1 = $7_1 << 1 | 0;
                $5_1 = $11_1;
                if ($5_1) {
                 continue label2
                }
                break label2;
               };
              }
              block24 : {
               if ($0_1 | $8_1 | 0) {
                break block24
               }
               $8_1 = 0;
               $0_1 = 2 << $6_1 | 0;
               $0_1 = ($0_1 | (0 - $0_1 | 0) | 0) & $10_1 | 0;
               if (!$0_1) {
                break block5
               }
               $0_1 = $72(((__wasm_ctz_i32($0_1 | 0) | 0) << 2 | 0) + 70036 | 0 | 0, 0 | 0) | 0;
              }
              if (!$0_1) {
               break block25
              }
             }
             label3 : while (1) {
              $2_1 = (($72($0_1 | 0, 4 | 0) | 0) & -8 | 0) - $3_1 | 0;
              $7_1 = $2_1 >>> 0 < $4_1 >>> 0;
              block26 : {
               $5_1 = $72($0_1 | 0, 16 | 0) | 0;
               if ($5_1) {
                break block26
               }
               $5_1 = $72($0_1 | 0, 20 | 0) | 0;
              }
              $4_1 = $7_1 ? $2_1 : $4_1;
              $8_1 = $7_1 ? $0_1 : $8_1;
              $0_1 = $5_1;
              if ($0_1) {
               continue label3
              }
              break label3;
             };
            }
            if (!$8_1) {
             break block5
            }
            if ($4_1 >>> 0 >= (($72(0 | 0, 69740 | 0) | 0) - $3_1 | 0) >>> 0) {
             break block5
            }
            $11_1 = $72($8_1 | 0, 24 | 0) | 0;
            block27 : {
             $0_1 = $72($8_1 | 0, 12 | 0) | 0;
             if (($0_1 | 0) == ($8_1 | 0)) {
              break block27
             }
             $5_1 = $72($8_1 | 0, 8 | 0) | 0;
             $101($5_1 | 0, 12 | 0, $0_1 | 0);
             $101($0_1 | 0, 8 | 0, $5_1 | 0);
             break block28;
            }
            block30 : {
             block29 : {
              $5_1 = $72($8_1 | 0, 20 | 0) | 0;
              if (!$5_1) {
               break block29
              }
              $7_1 = $8_1 + 20 | 0;
              break block30;
             }
             $5_1 = $72($8_1 | 0, 16 | 0) | 0;
             if (!$5_1) {
              break block31
             }
             $7_1 = $8_1 + 16 | 0;
            }
            label4 : while (1) {
             $2_1 = $7_1;
             $0_1 = $5_1;
             $7_1 = $0_1 + 20 | 0;
             $5_1 = $72($0_1 | 0, 20 | 0) | 0;
             if ($5_1) {
              continue label4
             }
             $7_1 = $0_1 + 16 | 0;
             $5_1 = $72($0_1 | 0, 16 | 0) | 0;
             if ($5_1) {
              continue label4
             }
             break label4;
            };
            $101($2_1 | 0, 0 | 0, 0 | 0);
            break block28;
           }
           block32 : {
            $0_1 = $72(0 | 0, 69740 | 0) | 0;
            if ($0_1 >>> 0 < $3_1 >>> 0) {
             break block32
            }
            $4_1 = $72(0 | 0, 69752 | 0) | 0;
            block34 : {
             block33 : {
              $5_1 = $0_1 - $3_1 | 0;
              if ($5_1 >>> 0 < 16 >>> 0) {
               break block33
              }
              $7_1 = $4_1 + $3_1 | 0;
              $101($7_1 | 0, 4 | 0, $5_1 | 1 | 0 | 0);
              $101($4_1 + $0_1 | 0 | 0, 0 | 0, $5_1 | 0);
              $101($4_1 | 0, 4 | 0, $3_1 | 3 | 0 | 0);
              break block34;
             }
             $101($4_1 | 0, 4 | 0, $0_1 | 3 | 0 | 0);
             $0_1 = $4_1 + $0_1 | 0;
             $101($0_1 | 0, 4 | 0, $72($0_1 | 0, 4 | 0) | 0 | 1 | 0 | 0);
             $7_1 = 0;
             $5_1 = 0;
            }
            $101(0 | 0, 69740 | 0, $5_1 | 0);
            $101(0 | 0, 69752 | 0, $7_1 | 0);
            $0_1 = $4_1 + 8 | 0;
            break block4;
           }
           block35 : {
            $7_1 = $72(0 | 0, 69744 | 0) | 0;
            if ($7_1 >>> 0 <= $3_1 >>> 0) {
             break block35
            }
            $4_1 = $7_1 - $3_1 | 0;
            $101(0 | 0, 69744 | 0, $4_1 | 0);
            $0_1 = $72(0 | 0, 69756 | 0) | 0;
            $5_1 = $0_1 + $3_1 | 0;
            $101(0 | 0, 69756 | 0, $5_1 | 0);
            $101($5_1 | 0, 4 | 0, $4_1 | 1 | 0 | 0);
            $101($0_1 | 0, 4 | 0, $3_1 | 3 | 0 | 0);
            $0_1 = $0_1 + 8 | 0;
            break block4;
           }
           block37 : {
            block36 : {
             if (!($72(0 | 0, 70204 | 0) | 0)) {
              break block36
             }
             $4_1 = $72(0 | 0, 70212 | 0) | 0;
             break block37;
            }
            i64toi32_i32$0 = -1;
            $110(0 | 0, 70216 | 0, -1 | 0, i64toi32_i32$0 | 0);
            i64toi32_i32$0 = 4096;
            $110(0 | 0, 70208 | 0, 4096 | 0, i64toi32_i32$0 | 0);
            $101(0 | 0, 70204 | 0, (($1_1 + 12 | 0) & -16 | 0) ^ 1431655768 | 0 | 0);
            $101(0 | 0, 70224 | 0, 0 | 0);
            $101(0 | 0, 70176 | 0, 0 | 0);
            $4_1 = 4096;
           }
           $0_1 = 0;
           $6_1 = $3_1 + 47 | 0;
           $2_1 = $4_1 + $6_1 | 0;
           $11_1 = 0 - $4_1 | 0;
           $8_1 = $2_1 & $11_1 | 0;
           if ($8_1 >>> 0 <= $3_1 >>> 0) {
            break block4
           }
           $0_1 = 0;
           block38 : {
            $4_1 = $72(0 | 0, 70172 | 0) | 0;
            if (!$4_1) {
             break block38
            }
            $5_1 = $72(0 | 0, 70164 | 0) | 0;
            $10_1 = $5_1 + $8_1 | 0;
            if ($10_1 >>> 0 <= $5_1 >>> 0) {
             break block4
            }
            if ($10_1 >>> 0 > $4_1 >>> 0) {
             break block4
            }
           }
           block47 : {
            block39 : {
             if (($65(0 | 0, 70176 | 0) | 0) & 4 | 0) {
              break block39
             }
             block43 : {
              block48 : {
               block46 : {
                block42 : {
                 block40 : {
                  $4_1 = $72(0 | 0, 69756 | 0) | 0;
                  if (!$4_1) {
                   break block40
                  }
                  $0_1 = 70180;
                  label5 : while (1) {
                   block41 : {
                    $5_1 = $72($0_1 | 0, 0 | 0) | 0;
                    if ($4_1 >>> 0 < $5_1 >>> 0) {
                     break block41
                    }
                    if ($4_1 >>> 0 < ($5_1 + ($72($0_1 | 0, 4 | 0) | 0) | 0) >>> 0) {
                     break block42
                    }
                   }
                   $0_1 = $72($0_1 | 0, 8 | 0) | 0;
                   if ($0_1) {
                    continue label5
                   }
                   break label5;
                  };
                 }
                 $7_1 = $46(0 | 0) | 0;
                 if (($7_1 | 0) == (-1 | 0)) {
                  break block43
                 }
                 $2_1 = $8_1;
                 block44 : {
                  $0_1 = $72(0 | 0, 70208 | 0) | 0;
                  $4_1 = $0_1 + -1 | 0;
                  if (!($4_1 & $7_1 | 0)) {
                   break block44
                  }
                  $2_1 = ($8_1 - $7_1 | 0) + (($4_1 + $7_1 | 0) & (0 - $0_1 | 0) | 0) | 0;
                 }
                 if ($2_1 >>> 0 <= $3_1 >>> 0) {
                  break block43
                 }
                 block45 : {
                  $0_1 = $72(0 | 0, 70172 | 0) | 0;
                  if (!$0_1) {
                   break block45
                  }
                  $4_1 = $72(0 | 0, 70164 | 0) | 0;
                  $5_1 = $4_1 + $2_1 | 0;
                  if ($5_1 >>> 0 <= $4_1 >>> 0) {
                   break block43
                  }
                  if ($5_1 >>> 0 > $0_1 >>> 0) {
                   break block43
                  }
                 }
                 $0_1 = $46($2_1 | 0) | 0;
                 if (($0_1 | 0) != ($7_1 | 0)) {
                  break block46
                 }
                 break block47;
                }
                $2_1 = ($2_1 - $7_1 | 0) & $11_1 | 0;
                $7_1 = $46($2_1 | 0) | 0;
                if (($7_1 | 0) == (($72($0_1 | 0, 0 | 0) | 0) + ($72($0_1 | 0, 4 | 0) | 0) | 0 | 0)) {
                 break block48
                }
                $0_1 = $7_1;
               }
               if (($0_1 | 0) == (-1 | 0)) {
                break block43
               }
               block49 : {
                if ($2_1 >>> 0 < ($3_1 + 48 | 0) >>> 0) {
                 break block49
                }
                $7_1 = $0_1;
                break block47;
               }
               $4_1 = $72(0 | 0, 70212 | 0) | 0;
               $4_1 = (($6_1 - $2_1 | 0) + $4_1 | 0) & (0 - $4_1 | 0) | 0;
               if (($46($4_1 | 0) | 0 | 0) == (-1 | 0)) {
                break block43
               }
               $2_1 = $4_1 + $2_1 | 0;
               $7_1 = $0_1;
               break block47;
              }
              if (($7_1 | 0) != (-1 | 0)) {
               break block47
              }
             }
             $101(0 | 0, 70176 | 0, $72(0 | 0, 70176 | 0) | 0 | 4 | 0 | 0);
            }
            $7_1 = $46($8_1 | 0) | 0;
            $0_1 = $46(0 | 0) | 0;
            if (($7_1 | 0) == (-1 | 0)) {
             break block50
            }
            if (($0_1 | 0) == (-1 | 0)) {
             break block50
            }
            if ($7_1 >>> 0 >= $0_1 >>> 0) {
             break block50
            }
            $2_1 = $0_1 - $7_1 | 0;
            if ($2_1 >>> 0 <= ($3_1 + 40 | 0) >>> 0) {
             break block50
            }
           }
           $0_1 = ($72(0 | 0, 70164 | 0) | 0) + $2_1 | 0;
           $101(0 | 0, 70164 | 0, $0_1 | 0);
           block51 : {
            if ($0_1 >>> 0 <= ($72(0 | 0, 70168 | 0) | 0) >>> 0) {
             break block51
            }
            $101(0 | 0, 70168 | 0, $0_1 | 0);
           }
           block53 : {
            block52 : {
             $4_1 = $72(0 | 0, 69756 | 0) | 0;
             if (!$4_1) {
              break block52
             }
             $0_1 = 70180;
             label6 : while (1) {
              $5_1 = $72($0_1 | 0, 0 | 0) | 0;
              $8_1 = $72($0_1 | 0, 4 | 0) | 0;
              if (($7_1 | 0) == ($5_1 + $8_1 | 0 | 0)) {
               break block53
              }
              $0_1 = $72($0_1 | 0, 8 | 0) | 0;
              if ($0_1) {
               continue label6
              }
              break block54;
             };
            }
            block56 : {
             block55 : {
              $0_1 = $72(0 | 0, 69748 | 0) | 0;
              if (!$0_1) {
               break block55
              }
              if ($7_1 >>> 0 >= $0_1 >>> 0) {
               break block56
              }
             }
             $101(0 | 0, 69748 | 0, $7_1 | 0);
            }
            $0_1 = 0;
            $101(0 | 0, 70184 | 0, $2_1 | 0);
            $101(0 | 0, 70180 | 0, $7_1 | 0);
            $101(0 | 0, 69764 | 0, -1 | 0);
            $101(0 | 0, 69768 | 0, $72(0 | 0, 70204 | 0) | 0 | 0);
            $101(0 | 0, 70192 | 0, 0 | 0);
            label7 : while (1) {
             $4_1 = $0_1 << 3 | 0;
             $5_1 = $4_1 + 69772 | 0;
             $101($4_1 + 69780 | 0 | 0, 0 | 0, $5_1 | 0);
             $101($4_1 + 69784 | 0 | 0, 0 | 0, $5_1 | 0);
             $0_1 = $0_1 + 1 | 0;
             if (($0_1 | 0) != (32 | 0)) {
              continue label7
             }
             break label7;
            };
            $0_1 = $2_1 + -40 | 0;
            $4_1 = (-8 - $7_1 | 0) & 7 | 0;
            $5_1 = $0_1 - $4_1 | 0;
            $101(0 | 0, 69744 | 0, $5_1 | 0);
            $4_1 = $7_1 + $4_1 | 0;
            $101(0 | 0, 69756 | 0, $4_1 | 0);
            $101($4_1 | 0, 4 | 0, $5_1 | 1 | 0 | 0);
            $101($7_1 + $0_1 | 0 | 0, 4 | 0, 40 | 0);
            $101(0 | 0, 69760 | 0, $72(0 | 0, 70220 | 0) | 0 | 0);
            break block57;
           }
           if ($4_1 >>> 0 >= $7_1 >>> 0) {
            break block54
           }
           if ($4_1 >>> 0 < $5_1 >>> 0) {
            break block54
           }
           if (($72($0_1 | 0, 12 | 0) | 0) & 8 | 0) {
            break block54
           }
           $101($0_1 | 0, 4 | 0, $8_1 + $2_1 | 0 | 0);
           $0_1 = (-8 - $4_1 | 0) & 7 | 0;
           $5_1 = $4_1 + $0_1 | 0;
           $101(0 | 0, 69756 | 0, $5_1 | 0);
           $7_1 = ($72(0 | 0, 69744 | 0) | 0) + $2_1 | 0;
           $0_1 = $7_1 - $0_1 | 0;
           $101(0 | 0, 69744 | 0, $0_1 | 0);
           $101($5_1 | 0, 4 | 0, $0_1 | 1 | 0 | 0);
           $101($4_1 + $7_1 | 0 | 0, 4 | 0, 40 | 0);
           $101(0 | 0, 69760 | 0, $72(0 | 0, 70220 | 0) | 0 | 0);
           break block57;
          }
          $0_1 = 0;
          break block15;
         }
         $0_1 = 0;
         break block28;
        }
        block58 : {
         if ($7_1 >>> 0 >= ($72(0 | 0, 69748 | 0) | 0) >>> 0) {
          break block58
         }
         $101(0 | 0, 69748 | 0, $7_1 | 0);
        }
        $5_1 = $7_1 + $2_1 | 0;
        $0_1 = 70180;
        block60 : {
         block59 : {
          label8 : while (1) {
           $8_1 = $72($0_1 | 0, 0 | 0) | 0;
           if (($8_1 | 0) == ($5_1 | 0)) {
            break block59
           }
           $0_1 = $72($0_1 | 0, 8 | 0) | 0;
           if ($0_1) {
            continue label8
           }
           break block60;
          };
         }
         if (!(($65($0_1 | 0, 12 | 0) | 0) & 8 | 0)) {
          break block61
         }
        }
        $0_1 = 70180;
        block63 : {
         label9 : while (1) {
          block62 : {
           $5_1 = $72($0_1 | 0, 0 | 0) | 0;
           if ($4_1 >>> 0 < $5_1 >>> 0) {
            break block62
           }
           $5_1 = $5_1 + ($72($0_1 | 0, 4 | 0) | 0) | 0;
           if ($4_1 >>> 0 < $5_1 >>> 0) {
            break block63
           }
          }
          $0_1 = $72($0_1 | 0, 8 | 0) | 0;
          continue label9;
         };
        }
        $0_1 = $2_1 + -40 | 0;
        $8_1 = (-8 - $7_1 | 0) & 7 | 0;
        $11_1 = $0_1 - $8_1 | 0;
        $101(0 | 0, 69744 | 0, $11_1 | 0);
        $8_1 = $7_1 + $8_1 | 0;
        $101(0 | 0, 69756 | 0, $8_1 | 0);
        $101($8_1 | 0, 4 | 0, $11_1 | 1 | 0 | 0);
        $101($7_1 + $0_1 | 0 | 0, 4 | 0, 40 | 0);
        $101(0 | 0, 69760 | 0, $72(0 | 0, 70220 | 0) | 0 | 0);
        $0_1 = ($5_1 + ((39 - $5_1 | 0) & 7 | 0) | 0) + -47 | 0;
        $8_1 = $0_1 >>> 0 < ($4_1 + 16 | 0) >>> 0 ? $4_1 : $0_1;
        $101($8_1 | 0, 4 | 0, 27 | 0);
        i64toi32_i32$0 = $87(0 | 0, 70188 | 0) | 0;
        i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
        $110($8_1 + 16 | 0 | 0, 0 | 0, i64toi32_i32$0 | 0, i64toi32_i32$1 | 0);
        i64toi32_i32$1 = $87(0 | 0, 70180 | 0) | 0;
        i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
        $110($8_1 | 0, 8 | 0, i64toi32_i32$1 | 0, i64toi32_i32$0 | 0);
        $101(0 | 0, 70188 | 0, $8_1 + 8 | 0 | 0);
        $101(0 | 0, 70184 | 0, $2_1 | 0);
        $101(0 | 0, 70180 | 0, $7_1 | 0);
        $101(0 | 0, 70192 | 0, 0 | 0);
        $0_1 = $8_1 + 24 | 0;
        label10 : while (1) {
         $101($0_1 | 0, 4 | 0, 7 | 0);
         $7_1 = $0_1 + 8 | 0;
         $0_1 = $0_1 + 4 | 0;
         if ($7_1 >>> 0 < $5_1 >>> 0) {
          continue label10
         }
         break label10;
        };
        if (($8_1 | 0) == ($4_1 | 0)) {
         break block57
        }
        $101($8_1 | 0, 4 | 0, ($72($8_1 | 0, 4 | 0) | 0) & -2 | 0 | 0);
        $7_1 = $8_1 - $4_1 | 0;
        $101($4_1 | 0, 4 | 0, $7_1 | 1 | 0 | 0);
        $101($8_1 | 0, 0 | 0, $7_1 | 0);
        block67 : {
         block64 : {
          if ($7_1 >>> 0 > 255 >>> 0) {
           break block64
          }
          $0_1 = ($7_1 & -8 | 0) + 69772 | 0;
          block66 : {
           block65 : {
            $5_1 = $72(0 | 0, 69732 | 0) | 0;
            $7_1 = 1 << ($7_1 >>> 3 | 0) | 0;
            if ($5_1 & $7_1 | 0) {
             break block65
            }
            $101(0 | 0, 69732 | 0, $5_1 | $7_1 | 0 | 0);
            $5_1 = $0_1;
            break block66;
           }
           $5_1 = $72($0_1 | 0, 8 | 0) | 0;
          }
          $101($0_1 | 0, 8 | 0, $4_1 | 0);
          $101($5_1 | 0, 12 | 0, $4_1 | 0);
          $7_1 = 12;
          $8_1 = 8;
          break block67;
         }
         $0_1 = 31;
         block68 : {
          if ($7_1 >>> 0 > 16777215 >>> 0) {
           break block68
          }
          $0_1 = Math_clz32($7_1 >>> 8 | 0);
          $0_1 = ((($7_1 >>> (38 - $0_1 | 0) | 0) & 1 | 0) - ($0_1 << 1 | 0) | 0) + 62 | 0;
         }
         $101($4_1 | 0, 28 | 0, $0_1 | 0);
         i64toi32_i32$0 = 0;
         $110($4_1 | 0, 16 | 0, 0 | 0, i64toi32_i32$0 | 0);
         $5_1 = ($0_1 << 2 | 0) + 70036 | 0;
         block71 : {
          block70 : {
           block69 : {
            $8_1 = $72(0 | 0, 69736 | 0) | 0;
            $2_1 = 1 << $0_1 | 0;
            if ($8_1 & $2_1 | 0) {
             break block69
            }
            $101(0 | 0, 69736 | 0, $8_1 | $2_1 | 0 | 0);
            $101($5_1 | 0, 0 | 0, $4_1 | 0);
            $101($4_1 | 0, 24 | 0, $5_1 | 0);
            break block70;
           }
           $0_1 = $7_1 << (($0_1 | 0) == (31 | 0) ? 0 : 25 - ($0_1 >>> 1 | 0) | 0) | 0;
           $8_1 = $72($5_1 | 0, 0 | 0) | 0;
           label11 : while (1) {
            $5_1 = $8_1;
            if ((($72($5_1 | 0, 4 | 0) | 0) & -8 | 0 | 0) == ($7_1 | 0)) {
             break block71
            }
            $8_1 = $0_1 >>> 29 | 0;
            $0_1 = $0_1 << 1 | 0;
            $2_1 = $5_1 + ($8_1 & 4 | 0) | 0;
            $8_1 = $72($2_1 | 0, 16 | 0) | 0;
            if ($8_1) {
             continue label11
            }
            break label11;
           };
           $101($2_1 + 16 | 0 | 0, 0 | 0, $4_1 | 0);
           $101($4_1 | 0, 24 | 0, $5_1 | 0);
          }
          $7_1 = 8;
          $8_1 = 12;
          $5_1 = $4_1;
          $0_1 = $4_1;
          break block67;
         }
         $0_1 = $72($5_1 | 0, 8 | 0) | 0;
         $101($0_1 | 0, 12 | 0, $4_1 | 0);
         $101($5_1 | 0, 8 | 0, $4_1 | 0);
         $101($4_1 | 0, 8 | 0, $0_1 | 0);
         $0_1 = 0;
         $7_1 = 24;
         $8_1 = 12;
        }
        $101($4_1 + $8_1 | 0 | 0, 0 | 0, $5_1 | 0);
        $101($4_1 + $7_1 | 0 | 0, 0 | 0, $0_1 | 0);
       }
       $0_1 = $72(0 | 0, 69744 | 0) | 0;
       if ($0_1 >>> 0 <= $3_1 >>> 0) {
        break block50
       }
       $4_1 = $0_1 - $3_1 | 0;
       $101(0 | 0, 69744 | 0, $4_1 | 0);
       $0_1 = $72(0 | 0, 69756 | 0) | 0;
       $5_1 = $0_1 + $3_1 | 0;
       $101(0 | 0, 69756 | 0, $5_1 | 0);
       $101($5_1 | 0, 4 | 0, $4_1 | 1 | 0 | 0);
       $101($0_1 | 0, 4 | 0, $3_1 | 3 | 0 | 0);
       $0_1 = $0_1 + 8 | 0;
       break block4;
      }
      $101($17() | 0 | 0, 0 | 0, 48 | 0);
      $0_1 = 0;
      break block4;
     }
     $101($0_1 | 0, 0 | 0, $7_1 | 0);
     $101($0_1 | 0, 4 | 0, ($72($0_1 | 0, 4 | 0) | 0) + $2_1 | 0 | 0);
     $0_1 = $42($7_1 | 0, $8_1 | 0, $3_1 | 0) | 0;
     break block4;
    }
    block72 : {
     if (!$11_1) {
      break block72
     }
     block74 : {
      block73 : {
       $7_1 = $72($8_1 | 0, 28 | 0) | 0;
       $5_1 = ($7_1 << 2 | 0) + 70036 | 0;
       if (($8_1 | 0) != ($72($5_1 | 0, 0 | 0) | 0 | 0)) {
        break block73
       }
       $101($5_1 | 0, 0 | 0, $0_1 | 0);
       if ($0_1) {
        break block74
       }
       $10_1 = $10_1 & (__wasm_rotl_i32(-2 | 0, $7_1 | 0) | 0) | 0;
       $101(0 | 0, 69736 | 0, $10_1 | 0);
       break block72;
      }
      block76 : {
       block75 : {
        if (($72($11_1 | 0, 16 | 0) | 0 | 0) != ($8_1 | 0)) {
         break block75
        }
        $101($11_1 | 0, 16 | 0, $0_1 | 0);
        break block76;
       }
       $101($11_1 | 0, 20 | 0, $0_1 | 0);
      }
      if (!$0_1) {
       break block72
      }
     }
     $101($0_1 | 0, 24 | 0, $11_1 | 0);
     block77 : {
      $5_1 = $72($8_1 | 0, 16 | 0) | 0;
      if (!$5_1) {
       break block77
      }
      $101($0_1 | 0, 16 | 0, $5_1 | 0);
      $101($5_1 | 0, 24 | 0, $0_1 | 0);
     }
     $5_1 = $72($8_1 | 0, 20 | 0) | 0;
     if (!$5_1) {
      break block72
     }
     $101($0_1 | 0, 20 | 0, $5_1 | 0);
     $101($5_1 | 0, 24 | 0, $0_1 | 0);
    }
    block79 : {
     block78 : {
      if ($4_1 >>> 0 > 15 >>> 0) {
       break block78
      }
      $0_1 = $4_1 + $3_1 | 0;
      $101($8_1 | 0, 4 | 0, $0_1 | 3 | 0 | 0);
      $0_1 = $8_1 + $0_1 | 0;
      $101($0_1 | 0, 4 | 0, $72($0_1 | 0, 4 | 0) | 0 | 1 | 0 | 0);
      break block79;
     }
     $101($8_1 | 0, 4 | 0, $3_1 | 3 | 0 | 0);
     $7_1 = $8_1 + $3_1 | 0;
     $101($7_1 | 0, 4 | 0, $4_1 | 1 | 0 | 0);
     $101($7_1 + $4_1 | 0 | 0, 0 | 0, $4_1 | 0);
     block80 : {
      if ($4_1 >>> 0 > 255 >>> 0) {
       break block80
      }
      $0_1 = ($4_1 & -8 | 0) + 69772 | 0;
      block82 : {
       block81 : {
        $3_1 = $72(0 | 0, 69732 | 0) | 0;
        $4_1 = 1 << ($4_1 >>> 3 | 0) | 0;
        if ($3_1 & $4_1 | 0) {
         break block81
        }
        $101(0 | 0, 69732 | 0, $3_1 | $4_1 | 0 | 0);
        $4_1 = $0_1;
        break block82;
       }
       $4_1 = $72($0_1 | 0, 8 | 0) | 0;
      }
      $101($0_1 | 0, 8 | 0, $7_1 | 0);
      $101($4_1 | 0, 12 | 0, $7_1 | 0);
      $101($7_1 | 0, 12 | 0, $0_1 | 0);
      $101($7_1 | 0, 8 | 0, $4_1 | 0);
      break block79;
     }
     $0_1 = 31;
     block83 : {
      if ($4_1 >>> 0 > 16777215 >>> 0) {
       break block83
      }
      $0_1 = Math_clz32($4_1 >>> 8 | 0);
      $0_1 = ((($4_1 >>> (38 - $0_1 | 0) | 0) & 1 | 0) - ($0_1 << 1 | 0) | 0) + 62 | 0;
     }
     $101($7_1 | 0, 28 | 0, $0_1 | 0);
     i64toi32_i32$0 = 0;
     $110($7_1 | 0, 16 | 0, 0 | 0, i64toi32_i32$0 | 0);
     $3_1 = ($0_1 << 2 | 0) + 70036 | 0;
     block86 : {
      block85 : {
       block84 : {
        $5_1 = 1 << $0_1 | 0;
        if ($10_1 & $5_1 | 0) {
         break block84
        }
        $101(0 | 0, 69736 | 0, $10_1 | $5_1 | 0 | 0);
        $101($3_1 | 0, 0 | 0, $7_1 | 0);
        $101($7_1 | 0, 24 | 0, $3_1 | 0);
        break block85;
       }
       $0_1 = $4_1 << (($0_1 | 0) == (31 | 0) ? 0 : 25 - ($0_1 >>> 1 | 0) | 0) | 0;
       $5_1 = $72($3_1 | 0, 0 | 0) | 0;
       label12 : while (1) {
        $3_1 = $5_1;
        if ((($72($5_1 | 0, 4 | 0) | 0) & -8 | 0 | 0) == ($4_1 | 0)) {
         break block86
        }
        $5_1 = $0_1 >>> 29 | 0;
        $0_1 = $0_1 << 1 | 0;
        $2_1 = $3_1 + ($5_1 & 4 | 0) | 0;
        $5_1 = $72($2_1 | 0, 16 | 0) | 0;
        if ($5_1) {
         continue label12
        }
        break label12;
       };
       $101($2_1 + 16 | 0 | 0, 0 | 0, $7_1 | 0);
       $101($7_1 | 0, 24 | 0, $3_1 | 0);
      }
      $101($7_1 | 0, 12 | 0, $7_1 | 0);
      $101($7_1 | 0, 8 | 0, $7_1 | 0);
      break block79;
     }
     $0_1 = $72($3_1 | 0, 8 | 0) | 0;
     $101($0_1 | 0, 12 | 0, $7_1 | 0);
     $101($3_1 | 0, 8 | 0, $7_1 | 0);
     $101($7_1 | 0, 24 | 0, 0 | 0);
     $101($7_1 | 0, 12 | 0, $3_1 | 0);
     $101($7_1 | 0, 8 | 0, $0_1 | 0);
    }
    $0_1 = $8_1 + 8 | 0;
    break block4;
   }
   block87 : {
    if (!$10_1) {
     break block87
    }
    block89 : {
     block88 : {
      $8_1 = $72($7_1 | 0, 28 | 0) | 0;
      $5_1 = ($8_1 << 2 | 0) + 70036 | 0;
      if (($7_1 | 0) != ($72($5_1 | 0, 0 | 0) | 0 | 0)) {
       break block88
      }
      $101($5_1 | 0, 0 | 0, $0_1 | 0);
      if ($0_1) {
       break block89
      }
      $101(0 | 0, 69736 | 0, $9_1 & (__wasm_rotl_i32(-2 | 0, $8_1 | 0) | 0) | 0 | 0);
      break block87;
     }
     block91 : {
      block90 : {
       if (($72($10_1 | 0, 16 | 0) | 0 | 0) != ($7_1 | 0)) {
        break block90
       }
       $101($10_1 | 0, 16 | 0, $0_1 | 0);
       break block91;
      }
      $101($10_1 | 0, 20 | 0, $0_1 | 0);
     }
     if (!$0_1) {
      break block87
     }
    }
    $101($0_1 | 0, 24 | 0, $10_1 | 0);
    block92 : {
     $5_1 = $72($7_1 | 0, 16 | 0) | 0;
     if (!$5_1) {
      break block92
     }
     $101($0_1 | 0, 16 | 0, $5_1 | 0);
     $101($5_1 | 0, 24 | 0, $0_1 | 0);
    }
    $5_1 = $72($7_1 | 0, 20 | 0) | 0;
    if (!$5_1) {
     break block87
    }
    $101($0_1 | 0, 20 | 0, $5_1 | 0);
    $101($5_1 | 0, 24 | 0, $0_1 | 0);
   }
   block94 : {
    block93 : {
     if ($4_1 >>> 0 > 15 >>> 0) {
      break block93
     }
     $0_1 = $4_1 + $3_1 | 0;
     $101($7_1 | 0, 4 | 0, $0_1 | 3 | 0 | 0);
     $0_1 = $7_1 + $0_1 | 0;
     $101($0_1 | 0, 4 | 0, $72($0_1 | 0, 4 | 0) | 0 | 1 | 0 | 0);
     break block94;
    }
    $101($7_1 | 0, 4 | 0, $3_1 | 3 | 0 | 0);
    $3_1 = $7_1 + $3_1 | 0;
    $101($3_1 | 0, 4 | 0, $4_1 | 1 | 0 | 0);
    $101($3_1 + $4_1 | 0 | 0, 0 | 0, $4_1 | 0);
    block95 : {
     if (!$6_1) {
      break block95
     }
     $5_1 = ($6_1 & -8 | 0) + 69772 | 0;
     $0_1 = $72(0 | 0, 69752 | 0) | 0;
     block97 : {
      block96 : {
       $8_1 = 1 << ($6_1 >>> 3 | 0) | 0;
       if ($8_1 & $2_1 | 0) {
        break block96
       }
       $101(0 | 0, 69732 | 0, $8_1 | $2_1 | 0 | 0);
       $8_1 = $5_1;
       break block97;
      }
      $8_1 = $72($5_1 | 0, 8 | 0) | 0;
     }
     $101($5_1 | 0, 8 | 0, $0_1 | 0);
     $101($8_1 | 0, 12 | 0, $0_1 | 0);
     $101($0_1 | 0, 12 | 0, $5_1 | 0);
     $101($0_1 | 0, 8 | 0, $8_1 | 0);
    }
    $101(0 | 0, 69752 | 0, $3_1 | 0);
    $101(0 | 0, 69740 | 0, $4_1 | 0);
   }
   $0_1 = $7_1 + 8 | 0;
  }
  global$0 = $1_1 + 16 | 0;
  return $0_1 | 0;
 }
 
 function $42($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $4_1 = 0, $5_1 = 0, $7_1 = 0, $8_1 = 0, $3_1 = 0, $6_1 = 0, $9_1 = 0;
  $3_1 = $0_1 + ((-8 - $0_1 | 0) & 7 | 0) | 0;
  $101($3_1 | 0, 4 | 0, $2_1 | 3 | 0 | 0);
  $4_1 = $1_1 + ((-8 - $1_1 | 0) & 7 | 0) | 0;
  $5_1 = $3_1 + $2_1 | 0;
  $0_1 = $4_1 - $5_1 | 0;
  block1 : {
   block : {
    if (($4_1 | 0) != ($72(0 | 0, 69756 | 0) | 0 | 0)) {
     break block
    }
    $101(0 | 0, 69756 | 0, $5_1 | 0);
    $2_1 = ($72(0 | 0, 69744 | 0) | 0) + $0_1 | 0;
    $101(0 | 0, 69744 | 0, $2_1 | 0);
    $101($5_1 | 0, 4 | 0, $2_1 | 1 | 0 | 0);
    break block1;
   }
   block2 : {
    if (($4_1 | 0) != ($72(0 | 0, 69752 | 0) | 0 | 0)) {
     break block2
    }
    $101(0 | 0, 69752 | 0, $5_1 | 0);
    $2_1 = ($72(0 | 0, 69740 | 0) | 0) + $0_1 | 0;
    $101(0 | 0, 69740 | 0, $2_1 | 0);
    $101($5_1 | 0, 4 | 0, $2_1 | 1 | 0 | 0);
    $101($5_1 + $2_1 | 0 | 0, 0 | 0, $2_1 | 0);
    break block1;
   }
   block3 : {
    $1_1 = $72($4_1 | 0, 4 | 0) | 0;
    if (($1_1 & 3 | 0 | 0) != (1 | 0)) {
     break block3
    }
    $6_1 = $1_1 & -8 | 0;
    $2_1 = $72($4_1 | 0, 12 | 0) | 0;
    block6 : {
     block4 : {
      if ($1_1 >>> 0 > 255 >>> 0) {
       break block4
      }
      block5 : {
       $7_1 = $72($4_1 | 0, 8 | 0) | 0;
       if (($2_1 | 0) != ($7_1 | 0)) {
        break block5
       }
       $101(0 | 0, 69732 | 0, ($72(0 | 0, 69732 | 0) | 0) & (__wasm_rotl_i32(-2 | 0, $1_1 >>> 3 | 0 | 0) | 0) | 0 | 0);
       break block6;
      }
      $101($7_1 | 0, 12 | 0, $2_1 | 0);
      $101($2_1 | 0, 8 | 0, $7_1 | 0);
      break block6;
     }
     $8_1 = $72($4_1 | 0, 24 | 0) | 0;
     block8 : {
      block7 : {
       if (($2_1 | 0) == ($4_1 | 0)) {
        break block7
       }
       $1_1 = $72($4_1 | 0, 8 | 0) | 0;
       $101($1_1 | 0, 12 | 0, $2_1 | 0);
       $101($2_1 | 0, 8 | 0, $1_1 | 0);
       break block8;
      }
      block11 : {
       block10 : {
        block9 : {
         $1_1 = $72($4_1 | 0, 20 | 0) | 0;
         if (!$1_1) {
          break block9
         }
         $7_1 = $4_1 + 20 | 0;
         break block10;
        }
        $1_1 = $72($4_1 | 0, 16 | 0) | 0;
        if (!$1_1) {
         break block11
        }
        $7_1 = $4_1 + 16 | 0;
       }
       label : while (1) {
        $9_1 = $7_1;
        $2_1 = $1_1;
        $7_1 = $2_1 + 20 | 0;
        $1_1 = $72($2_1 | 0, 20 | 0) | 0;
        if ($1_1) {
         continue label
        }
        $7_1 = $2_1 + 16 | 0;
        $1_1 = $72($2_1 | 0, 16 | 0) | 0;
        if ($1_1) {
         continue label
        }
        break label;
       };
       $101($9_1 | 0, 0 | 0, 0 | 0);
       break block8;
      }
      $2_1 = 0;
     }
     if (!$8_1) {
      break block6
     }
     block13 : {
      block12 : {
       $7_1 = $72($4_1 | 0, 28 | 0) | 0;
       $1_1 = ($7_1 << 2 | 0) + 70036 | 0;
       if (($4_1 | 0) != ($72($1_1 | 0, 0 | 0) | 0 | 0)) {
        break block12
       }
       $101($1_1 | 0, 0 | 0, $2_1 | 0);
       if ($2_1) {
        break block13
       }
       $101(0 | 0, 69736 | 0, ($72(0 | 0, 69736 | 0) | 0) & (__wasm_rotl_i32(-2 | 0, $7_1 | 0) | 0) | 0 | 0);
       break block6;
      }
      block15 : {
       block14 : {
        if (($72($8_1 | 0, 16 | 0) | 0 | 0) != ($4_1 | 0)) {
         break block14
        }
        $101($8_1 | 0, 16 | 0, $2_1 | 0);
        break block15;
       }
       $101($8_1 | 0, 20 | 0, $2_1 | 0);
      }
      if (!$2_1) {
       break block6
      }
     }
     $101($2_1 | 0, 24 | 0, $8_1 | 0);
     block16 : {
      $1_1 = $72($4_1 | 0, 16 | 0) | 0;
      if (!$1_1) {
       break block16
      }
      $101($2_1 | 0, 16 | 0, $1_1 | 0);
      $101($1_1 | 0, 24 | 0, $2_1 | 0);
     }
     $1_1 = $72($4_1 | 0, 20 | 0) | 0;
     if (!$1_1) {
      break block6
     }
     $101($2_1 | 0, 20 | 0, $1_1 | 0);
     $101($1_1 | 0, 24 | 0, $2_1 | 0);
    }
    $0_1 = $6_1 + $0_1 | 0;
    $4_1 = $4_1 + $6_1 | 0;
    $1_1 = $72($4_1 | 0, 4 | 0) | 0;
   }
   $101($4_1 | 0, 4 | 0, $1_1 & -2 | 0 | 0);
   $101($5_1 | 0, 4 | 0, $0_1 | 1 | 0 | 0);
   $101($5_1 + $0_1 | 0 | 0, 0 | 0, $0_1 | 0);
   block17 : {
    if ($0_1 >>> 0 > 255 >>> 0) {
     break block17
    }
    $2_1 = ($0_1 & -8 | 0) + 69772 | 0;
    block19 : {
     block18 : {
      $1_1 = $72(0 | 0, 69732 | 0) | 0;
      $0_1 = 1 << ($0_1 >>> 3 | 0) | 0;
      if ($1_1 & $0_1 | 0) {
       break block18
      }
      $101(0 | 0, 69732 | 0, $1_1 | $0_1 | 0 | 0);
      $0_1 = $2_1;
      break block19;
     }
     $0_1 = $72($2_1 | 0, 8 | 0) | 0;
    }
    $101($2_1 | 0, 8 | 0, $5_1 | 0);
    $101($0_1 | 0, 12 | 0, $5_1 | 0);
    $101($5_1 | 0, 12 | 0, $2_1 | 0);
    $101($5_1 | 0, 8 | 0, $0_1 | 0);
    break block1;
   }
   $2_1 = 31;
   block20 : {
    if ($0_1 >>> 0 > 16777215 >>> 0) {
     break block20
    }
    $2_1 = Math_clz32($0_1 >>> 8 | 0);
    $2_1 = ((($0_1 >>> (38 - $2_1 | 0) | 0) & 1 | 0) - ($2_1 << 1 | 0) | 0) + 62 | 0;
   }
   $101($5_1 | 0, 28 | 0, $2_1 | 0);
   $110($5_1 | 0, 16 | 0, 0 | 0, 0 | 0);
   $1_1 = ($2_1 << 2 | 0) + 70036 | 0;
   block23 : {
    block22 : {
     block21 : {
      $7_1 = $72(0 | 0, 69736 | 0) | 0;
      $4_1 = 1 << $2_1 | 0;
      if ($7_1 & $4_1 | 0) {
       break block21
      }
      $101(0 | 0, 69736 | 0, $7_1 | $4_1 | 0 | 0);
      $101($1_1 | 0, 0 | 0, $5_1 | 0);
      $101($5_1 | 0, 24 | 0, $1_1 | 0);
      break block22;
     }
     $2_1 = $0_1 << (($2_1 | 0) == (31 | 0) ? 0 : 25 - ($2_1 >>> 1 | 0) | 0) | 0;
     $7_1 = $72($1_1 | 0, 0 | 0) | 0;
     label1 : while (1) {
      $1_1 = $7_1;
      if ((($72($1_1 | 0, 4 | 0) | 0) & -8 | 0 | 0) == ($0_1 | 0)) {
       break block23
      }
      $7_1 = $2_1 >>> 29 | 0;
      $2_1 = $2_1 << 1 | 0;
      $4_1 = $1_1 + ($7_1 & 4 | 0) | 0;
      $7_1 = $72($4_1 | 0, 16 | 0) | 0;
      if ($7_1) {
       continue label1
      }
      break label1;
     };
     $101($4_1 + 16 | 0 | 0, 0 | 0, $5_1 | 0);
     $101($5_1 | 0, 24 | 0, $1_1 | 0);
    }
    $101($5_1 | 0, 12 | 0, $5_1 | 0);
    $101($5_1 | 0, 8 | 0, $5_1 | 0);
    break block1;
   }
   $2_1 = $72($1_1 | 0, 8 | 0) | 0;
   $101($2_1 | 0, 12 | 0, $5_1 | 0);
   $101($1_1 | 0, 8 | 0, $5_1 | 0);
   $101($5_1 | 0, 24 | 0, 0 | 0);
   $101($5_1 | 0, 12 | 0, $1_1 | 0);
   $101($5_1 | 0, 8 | 0, $2_1 | 0);
  }
  return $3_1 + 8 | 0 | 0;
 }
 
 function $43($0_1) {
  $0_1 = $0_1 | 0;
  var $2_1 = 0, $4_1 = 0, $1_1 = 0, $5_1 = 0, $3_1 = 0, $6_1 = 0, $8_1 = 0, $7_1 = 0;
  block : {
   if (!$0_1) {
    break block
   }
   $1_1 = $0_1 + -8 | 0;
   $2_1 = $72($0_1 + -4 | 0 | 0, 0 | 0) | 0;
   $0_1 = $2_1 & -8 | 0;
   $3_1 = $1_1 + $0_1 | 0;
   block1 : {
    if ($2_1 & 1 | 0) {
     break block1
    }
    if (!($2_1 & 2 | 0)) {
     break block
    }
    $4_1 = $72($1_1 | 0, 0 | 0) | 0;
    $1_1 = $1_1 - $4_1 | 0;
    if ($1_1 >>> 0 < ($72(0 | 0, 69748 | 0) | 0) >>> 0) {
     break block
    }
    $0_1 = $4_1 + $0_1 | 0;
    block6 : {
     block9 : {
      block4 : {
       block2 : {
        if (($1_1 | 0) == ($72(0 | 0, 69752 | 0) | 0 | 0)) {
         break block2
        }
        $2_1 = $72($1_1 | 0, 12 | 0) | 0;
        block3 : {
         if ($4_1 >>> 0 > 255 >>> 0) {
          break block3
         }
         $5_1 = $72($1_1 | 0, 8 | 0) | 0;
         if (($2_1 | 0) != ($5_1 | 0)) {
          break block4
         }
         $101(0 | 0, 69732 | 0, ($72(0 | 0, 69732 | 0) | 0) & (__wasm_rotl_i32(-2 | 0, $4_1 >>> 3 | 0 | 0) | 0) | 0 | 0);
         break block1;
        }
        $6_1 = $72($1_1 | 0, 24 | 0) | 0;
        block5 : {
         if (($2_1 | 0) == ($1_1 | 0)) {
          break block5
         }
         $4_1 = $72($1_1 | 0, 8 | 0) | 0;
         $101($4_1 | 0, 12 | 0, $2_1 | 0);
         $101($2_1 | 0, 8 | 0, $4_1 | 0);
         break block6;
        }
        block8 : {
         block7 : {
          $4_1 = $72($1_1 | 0, 20 | 0) | 0;
          if (!$4_1) {
           break block7
          }
          $5_1 = $1_1 + 20 | 0;
          break block8;
         }
         $4_1 = $72($1_1 | 0, 16 | 0) | 0;
         if (!$4_1) {
          break block9
         }
         $5_1 = $1_1 + 16 | 0;
        }
        label : while (1) {
         $7_1 = $5_1;
         $2_1 = $4_1;
         $5_1 = $2_1 + 20 | 0;
         $4_1 = $72($2_1 | 0, 20 | 0) | 0;
         if ($4_1) {
          continue label
         }
         $5_1 = $2_1 + 16 | 0;
         $4_1 = $72($2_1 | 0, 16 | 0) | 0;
         if ($4_1) {
          continue label
         }
         break label;
        };
        $101($7_1 | 0, 0 | 0, 0 | 0);
        break block6;
       }
       $2_1 = $72($3_1 | 0, 4 | 0) | 0;
       if (($2_1 & 3 | 0 | 0) != (3 | 0)) {
        break block1
       }
       $101(0 | 0, 69740 | 0, $0_1 | 0);
       $101($3_1 | 0, 4 | 0, $2_1 & -2 | 0 | 0);
       $101($1_1 | 0, 4 | 0, $0_1 | 1 | 0 | 0);
       $101($3_1 | 0, 0 | 0, $0_1 | 0);
       return;
      }
      $101($5_1 | 0, 12 | 0, $2_1 | 0);
      $101($2_1 | 0, 8 | 0, $5_1 | 0);
      break block1;
     }
     $2_1 = 0;
    }
    if (!$6_1) {
     break block1
    }
    block11 : {
     block10 : {
      $5_1 = $72($1_1 | 0, 28 | 0) | 0;
      $4_1 = ($5_1 << 2 | 0) + 70036 | 0;
      if (($1_1 | 0) != ($72($4_1 | 0, 0 | 0) | 0 | 0)) {
       break block10
      }
      $101($4_1 | 0, 0 | 0, $2_1 | 0);
      if ($2_1) {
       break block11
      }
      $101(0 | 0, 69736 | 0, ($72(0 | 0, 69736 | 0) | 0) & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0 | 0);
      break block1;
     }
     block13 : {
      block12 : {
       if (($72($6_1 | 0, 16 | 0) | 0 | 0) != ($1_1 | 0)) {
        break block12
       }
       $101($6_1 | 0, 16 | 0, $2_1 | 0);
       break block13;
      }
      $101($6_1 | 0, 20 | 0, $2_1 | 0);
     }
     if (!$2_1) {
      break block1
     }
    }
    $101($2_1 | 0, 24 | 0, $6_1 | 0);
    block14 : {
     $4_1 = $72($1_1 | 0, 16 | 0) | 0;
     if (!$4_1) {
      break block14
     }
     $101($2_1 | 0, 16 | 0, $4_1 | 0);
     $101($4_1 | 0, 24 | 0, $2_1 | 0);
    }
    $4_1 = $72($1_1 | 0, 20 | 0) | 0;
    if (!$4_1) {
     break block1
    }
    $101($2_1 | 0, 20 | 0, $4_1 | 0);
    $101($4_1 | 0, 24 | 0, $2_1 | 0);
   }
   if ($1_1 >>> 0 >= $3_1 >>> 0) {
    break block
   }
   $4_1 = $72($3_1 | 0, 4 | 0) | 0;
   if (!($4_1 & 1 | 0)) {
    break block
   }
   block26 : {
    block20 : {
     block22 : {
      block25 : {
       block15 : {
        if ($4_1 & 2 | 0) {
         break block15
        }
        block16 : {
         if (($3_1 | 0) != ($72(0 | 0, 69756 | 0) | 0 | 0)) {
          break block16
         }
         $101(0 | 0, 69756 | 0, $1_1 | 0);
         $0_1 = ($72(0 | 0, 69744 | 0) | 0) + $0_1 | 0;
         $101(0 | 0, 69744 | 0, $0_1 | 0);
         $101($1_1 | 0, 4 | 0, $0_1 | 1 | 0 | 0);
         if (($1_1 | 0) != ($72(0 | 0, 69752 | 0) | 0 | 0)) {
          break block
         }
         $101(0 | 0, 69740 | 0, 0 | 0);
         $101(0 | 0, 69752 | 0, 0 | 0);
         return;
        }
        block17 : {
         $6_1 = $72(0 | 0, 69752 | 0) | 0;
         if (($3_1 | 0) != ($6_1 | 0)) {
          break block17
         }
         $101(0 | 0, 69752 | 0, $1_1 | 0);
         $0_1 = ($72(0 | 0, 69740 | 0) | 0) + $0_1 | 0;
         $101(0 | 0, 69740 | 0, $0_1 | 0);
         $101($1_1 | 0, 4 | 0, $0_1 | 1 | 0 | 0);
         $101($1_1 + $0_1 | 0 | 0, 0 | 0, $0_1 | 0);
         return;
        }
        $0_1 = ($4_1 & -8 | 0) + $0_1 | 0;
        $2_1 = $72($3_1 | 0, 12 | 0) | 0;
        block18 : {
         if ($4_1 >>> 0 > 255 >>> 0) {
          break block18
         }
         block19 : {
          $5_1 = $72($3_1 | 0, 8 | 0) | 0;
          if (($2_1 | 0) != ($5_1 | 0)) {
           break block19
          }
          $101(0 | 0, 69732 | 0, ($72(0 | 0, 69732 | 0) | 0) & (__wasm_rotl_i32(-2 | 0, $4_1 >>> 3 | 0 | 0) | 0) | 0 | 0);
          break block20;
         }
         $101($5_1 | 0, 12 | 0, $2_1 | 0);
         $101($2_1 | 0, 8 | 0, $5_1 | 0);
         break block20;
        }
        $8_1 = $72($3_1 | 0, 24 | 0) | 0;
        block21 : {
         if (($2_1 | 0) == ($3_1 | 0)) {
          break block21
         }
         $4_1 = $72($3_1 | 0, 8 | 0) | 0;
         $101($4_1 | 0, 12 | 0, $2_1 | 0);
         $101($2_1 | 0, 8 | 0, $4_1 | 0);
         break block22;
        }
        block24 : {
         block23 : {
          $4_1 = $72($3_1 | 0, 20 | 0) | 0;
          if (!$4_1) {
           break block23
          }
          $5_1 = $3_1 + 20 | 0;
          break block24;
         }
         $4_1 = $72($3_1 | 0, 16 | 0) | 0;
         if (!$4_1) {
          break block25
         }
         $5_1 = $3_1 + 16 | 0;
        }
        label1 : while (1) {
         $7_1 = $5_1;
         $2_1 = $4_1;
         $5_1 = $2_1 + 20 | 0;
         $4_1 = $72($2_1 | 0, 20 | 0) | 0;
         if ($4_1) {
          continue label1
         }
         $5_1 = $2_1 + 16 | 0;
         $4_1 = $72($2_1 | 0, 16 | 0) | 0;
         if ($4_1) {
          continue label1
         }
         break label1;
        };
        $101($7_1 | 0, 0 | 0, 0 | 0);
        break block22;
       }
       $101($3_1 | 0, 4 | 0, $4_1 & -2 | 0 | 0);
       $101($1_1 | 0, 4 | 0, $0_1 | 1 | 0 | 0);
       $101($1_1 + $0_1 | 0 | 0, 0 | 0, $0_1 | 0);
       break block26;
      }
      $2_1 = 0;
     }
     if (!$8_1) {
      break block20
     }
     block28 : {
      block27 : {
       $5_1 = $72($3_1 | 0, 28 | 0) | 0;
       $4_1 = ($5_1 << 2 | 0) + 70036 | 0;
       if (($3_1 | 0) != ($72($4_1 | 0, 0 | 0) | 0 | 0)) {
        break block27
       }
       $101($4_1 | 0, 0 | 0, $2_1 | 0);
       if ($2_1) {
        break block28
       }
       $101(0 | 0, 69736 | 0, ($72(0 | 0, 69736 | 0) | 0) & (__wasm_rotl_i32(-2 | 0, $5_1 | 0) | 0) | 0 | 0);
       break block20;
      }
      block30 : {
       block29 : {
        if (($72($8_1 | 0, 16 | 0) | 0 | 0) != ($3_1 | 0)) {
         break block29
        }
        $101($8_1 | 0, 16 | 0, $2_1 | 0);
        break block30;
       }
       $101($8_1 | 0, 20 | 0, $2_1 | 0);
      }
      if (!$2_1) {
       break block20
      }
     }
     $101($2_1 | 0, 24 | 0, $8_1 | 0);
     block31 : {
      $4_1 = $72($3_1 | 0, 16 | 0) | 0;
      if (!$4_1) {
       break block31
      }
      $101($2_1 | 0, 16 | 0, $4_1 | 0);
      $101($4_1 | 0, 24 | 0, $2_1 | 0);
     }
     $4_1 = $72($3_1 | 0, 20 | 0) | 0;
     if (!$4_1) {
      break block20
     }
     $101($2_1 | 0, 20 | 0, $4_1 | 0);
     $101($4_1 | 0, 24 | 0, $2_1 | 0);
    }
    $101($1_1 | 0, 4 | 0, $0_1 | 1 | 0 | 0);
    $101($1_1 + $0_1 | 0 | 0, 0 | 0, $0_1 | 0);
    if (($1_1 | 0) != ($6_1 | 0)) {
     break block26
    }
    $101(0 | 0, 69740 | 0, $0_1 | 0);
    return;
   }
   block32 : {
    if ($0_1 >>> 0 > 255 >>> 0) {
     break block32
    }
    $2_1 = ($0_1 & -8 | 0) + 69772 | 0;
    block34 : {
     block33 : {
      $4_1 = $72(0 | 0, 69732 | 0) | 0;
      $0_1 = 1 << ($0_1 >>> 3 | 0) | 0;
      if ($4_1 & $0_1 | 0) {
       break block33
      }
      $101(0 | 0, 69732 | 0, $4_1 | $0_1 | 0 | 0);
      $0_1 = $2_1;
      break block34;
     }
     $0_1 = $72($2_1 | 0, 8 | 0) | 0;
    }
    $101($2_1 | 0, 8 | 0, $1_1 | 0);
    $101($0_1 | 0, 12 | 0, $1_1 | 0);
    $101($1_1 | 0, 12 | 0, $2_1 | 0);
    $101($1_1 | 0, 8 | 0, $0_1 | 0);
    return;
   }
   $2_1 = 31;
   block35 : {
    if ($0_1 >>> 0 > 16777215 >>> 0) {
     break block35
    }
    $2_1 = Math_clz32($0_1 >>> 8 | 0);
    $2_1 = ((($0_1 >>> (38 - $2_1 | 0) | 0) & 1 | 0) - ($2_1 << 1 | 0) | 0) + 62 | 0;
   }
   $101($1_1 | 0, 28 | 0, $2_1 | 0);
   $110($1_1 | 0, 16 | 0, 0 | 0, 0 | 0);
   $5_1 = ($2_1 << 2 | 0) + 70036 | 0;
   block39 : {
    block38 : {
     block37 : {
      block36 : {
       $4_1 = $72(0 | 0, 69736 | 0) | 0;
       $3_1 = 1 << $2_1 | 0;
       if ($4_1 & $3_1 | 0) {
        break block36
       }
       $101(0 | 0, 69736 | 0, $4_1 | $3_1 | 0 | 0);
       $101($5_1 | 0, 0 | 0, $1_1 | 0);
       $0_1 = 8;
       $2_1 = 24;
       break block37;
      }
      $2_1 = $0_1 << (($2_1 | 0) == (31 | 0) ? 0 : 25 - ($2_1 >>> 1 | 0) | 0) | 0;
      $5_1 = $72($5_1 | 0, 0 | 0) | 0;
      label2 : while (1) {
       $4_1 = $5_1;
       if ((($72($4_1 | 0, 4 | 0) | 0) & -8 | 0 | 0) == ($0_1 | 0)) {
        break block38
       }
       $5_1 = $2_1 >>> 29 | 0;
       $2_1 = $2_1 << 1 | 0;
       $3_1 = $4_1 + ($5_1 & 4 | 0) | 0;
       $5_1 = $72($3_1 | 0, 16 | 0) | 0;
       if ($5_1) {
        continue label2
       }
       break label2;
      };
      $101($3_1 + 16 | 0 | 0, 0 | 0, $1_1 | 0);
      $0_1 = 8;
      $2_1 = 24;
      $5_1 = $4_1;
     }
     $4_1 = $1_1;
     $3_1 = $4_1;
     break block39;
    }
    $5_1 = $72($4_1 | 0, 8 | 0) | 0;
    $101($5_1 | 0, 12 | 0, $1_1 | 0);
    $101($4_1 | 0, 8 | 0, $1_1 | 0);
    $3_1 = 0;
    $0_1 = 24;
    $2_1 = 8;
   }
   $101($1_1 + $2_1 | 0 | 0, 0 | 0, $5_1 | 0);
   $101($1_1 | 0, 12 | 0, $4_1 | 0);
   $101($1_1 + $0_1 | 0 | 0, 0 | 0, $3_1 | 0);
   $1_1 = ($72(0 | 0, 69764 | 0) | 0) + -1 | 0;
   $101(0 | 0, 69764 | 0, ($1_1 ? $1_1 : -1) | 0);
  }
 }
 
 function $44() {
  return __wasm_memory_size() << 16 | 0 | 0;
 }
 
 function $45() {
  return 68492 | 0;
 }
 
 function $46($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, $2_1 = 0;
  $1_1 = $72(0 | 0, 68492 | 0) | 0;
  $2_1 = ($0_1 + 7 | 0) & -8 | 0;
  $0_1 = $1_1 + $2_1 | 0;
  block2 : {
   block1 : {
    block : {
     if (!$2_1) {
      break block
     }
     if ($0_1 >>> 0 <= $1_1 >>> 0) {
      break block1
     }
    }
    if ($0_1 >>> 0 <= ($44() | 0) >>> 0) {
     break block2
    }
    if (fimport$2($0_1 | 0) | 0) {
     break block2
    }
   }
   $101($17() | 0 | 0, 0 | 0, 48 | 0);
   return -1 | 0;
  }
  $101(0 | 0, 68492 | 0, $0_1 | 0);
  return $1_1 | 0;
 }
 
 function $47($0_1, $1_1, $1$hi, $2_1, $2$hi, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  $2$hi = $2$hi | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$1 = 0, i64toi32_i32$4 = 0, i64toi32_i32$2 = 0, i64toi32_i32$0 = 0, i64toi32_i32$3 = 0, $4$hi = 0, $18_1 = 0, $20_1 = 0, $21_1 = 0, $22_1 = 0, $11$hi = 0, $18$hi = 0, $19_1 = 0, $19$hi = 0, $4_1 = 0, $24$hi = 0;
  block1 : {
   block : {
    if (!($3_1 & 64 | 0)) {
     break block
    }
    i64toi32_i32$0 = $1$hi;
    i64toi32_i32$0 = 0;
    $11$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $1$hi;
    i64toi32_i32$2 = $1_1;
    i64toi32_i32$1 = $11$hi;
    i64toi32_i32$3 = $3_1 + -64 | 0;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
     $18_1 = 0;
    } else {
     i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
     $18_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
    }
    $2_1 = $18_1;
    $2$hi = i64toi32_i32$1;
    i64toi32_i32$1 = 0;
    $1_1 = 0;
    $1$hi = i64toi32_i32$1;
    break block1;
   }
   if (!$3_1) {
    break block1
   }
   i64toi32_i32$1 = $1$hi;
   i64toi32_i32$1 = 0;
   $18$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $1$hi;
   i64toi32_i32$0 = $1_1;
   i64toi32_i32$2 = $18$hi;
   i64toi32_i32$3 = 64 - $3_1 | 0;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = 0;
    $20_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
   } else {
    i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
    $20_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
   }
   $19_1 = $20_1;
   $19$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $2$hi;
   i64toi32_i32$2 = 0;
   $4_1 = $3_1;
   $4$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $2$hi;
   i64toi32_i32$1 = $2_1;
   i64toi32_i32$0 = $4$hi;
   i64toi32_i32$3 = $3_1;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$0 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
    $21_1 = 0;
   } else {
    i64toi32_i32$0 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$1 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$4 | 0) | 0;
    $21_1 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
   }
   $24$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $19$hi;
   i64toi32_i32$2 = $19_1;
   i64toi32_i32$1 = $24$hi;
   i64toi32_i32$3 = $21_1;
   i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
   $2_1 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
   $2$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $1$hi;
   i64toi32_i32$1 = $4$hi;
   i64toi32_i32$1 = $1$hi;
   i64toi32_i32$0 = $1_1;
   i64toi32_i32$2 = $4$hi;
   i64toi32_i32$3 = $4_1;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
    $22_1 = 0;
   } else {
    i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
    $22_1 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
   }
   $1_1 = $22_1;
   $1$hi = i64toi32_i32$2;
  }
  i64toi32_i32$2 = $1$hi;
  $111($0_1 | 0, 0 | 0, $1_1 | 0, i64toi32_i32$2 | 0);
  i64toi32_i32$2 = $2$hi;
  $111($0_1 | 0, 8 | 0, $2_1 | 0, i64toi32_i32$2 | 0);
 }
 
 function $48($0_1, $1_1, $1$hi, $2_1, $2$hi, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  $2_1 = $2_1 | 0;
  $2$hi = $2$hi | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$4 = 0, i64toi32_i32$2 = 0, i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$3 = 0, $4$hi = 0, $18_1 = 0, $20_1 = 0, $21_1 = 0, $22_1 = 0, $11$hi = 0, $18$hi = 0, $19_1 = 0, $19$hi = 0, $4_1 = 0, $24$hi = 0;
  block1 : {
   block : {
    if (!($3_1 & 64 | 0)) {
     break block
    }
    i64toi32_i32$0 = $2$hi;
    i64toi32_i32$0 = 0;
    $11$hi = i64toi32_i32$0;
    i64toi32_i32$0 = $2$hi;
    i64toi32_i32$2 = $2_1;
    i64toi32_i32$1 = $11$hi;
    i64toi32_i32$3 = $3_1 + -64 | 0;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = 0;
     $18_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
     $18_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
    }
    $1_1 = $18_1;
    $1$hi = i64toi32_i32$1;
    i64toi32_i32$1 = 0;
    $2_1 = 0;
    $2$hi = i64toi32_i32$1;
    break block1;
   }
   if (!$3_1) {
    break block1
   }
   i64toi32_i32$1 = $2$hi;
   i64toi32_i32$1 = 0;
   $18$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $2$hi;
   i64toi32_i32$0 = $2_1;
   i64toi32_i32$2 = $18$hi;
   i64toi32_i32$3 = 64 - $3_1 | 0;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
    $20_1 = 0;
   } else {
    i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
    $20_1 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
   }
   $19_1 = $20_1;
   $19$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $1$hi;
   i64toi32_i32$2 = 0;
   $4_1 = $3_1;
   $4$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $1$hi;
   i64toi32_i32$1 = $1_1;
   i64toi32_i32$0 = $4$hi;
   i64toi32_i32$3 = $3_1;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$0 = 0;
    $21_1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
   } else {
    i64toi32_i32$0 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
    $21_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$4 | 0) | 0;
   }
   $24$hi = i64toi32_i32$0;
   i64toi32_i32$0 = $19$hi;
   i64toi32_i32$2 = $19_1;
   i64toi32_i32$1 = $24$hi;
   i64toi32_i32$3 = $21_1;
   i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
   $1_1 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
   $1$hi = i64toi32_i32$1;
   i64toi32_i32$1 = $2$hi;
   i64toi32_i32$1 = $4$hi;
   i64toi32_i32$1 = $2$hi;
   i64toi32_i32$0 = $2_1;
   i64toi32_i32$2 = $4$hi;
   i64toi32_i32$3 = $4_1;
   i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = 0;
    $22_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
   } else {
    i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
    $22_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
   }
   $2_1 = $22_1;
   $2$hi = i64toi32_i32$2;
  }
  i64toi32_i32$2 = $1$hi;
  $111($0_1 | 0, 0 | 0, $1_1 | 0, i64toi32_i32$2 | 0);
  i64toi32_i32$2 = $2$hi;
  $111($0_1 | 0, 8 | 0, $2_1 | 0, i64toi32_i32$2 | 0);
 }
 
 function $49($0_1, $0$hi, $1_1, $1$hi) {
  $0_1 = $0_1 | 0;
  $0$hi = $0$hi | 0;
  $1_1 = $1_1 | 0;
  $1$hi = $1$hi | 0;
  var i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$5 = 0, i64toi32_i32$4 = 0, $7_1 = 0, $7$hi = 0, $3_1 = 0, $2_1 = 0, $8_1 = 0, $8$hi = 0, $6_1 = 0, $47_1 = 0, $48_1 = 0, $49_1 = 0, $50_1 = 0, $51 = 0, $4_1 = 0, $5_1 = 0, $52_1 = 0, $53_1 = 0, $54_1 = 0, $23_1 = 0, $23$hi = 0, $25$hi = 0, $39$hi = 0, $48$hi = 0, $58_1 = 0, $58$hi = 0, $60$hi = 0, $79 = 0, $79$hi = 0, $92 = 0, $92$hi = 0, $96$hi = 0, $99 = 0, $99$hi = 0, $104 = 0, $104$hi = 0, $108 = 0, $108$hi = 0, $111_1 = 0, $112$hi = 0, $121$hi = 0, $125 = 0, $125$hi = 0, $136$hi = 0, $138 = 0, $138$hi = 0, $139$hi = 0;
  $2_1 = global$0 - 32 | 0;
  global$0 = $2_1;
  i64toi32_i32$0 = $1$hi;
  i64toi32_i32$2 = $1_1;
  i64toi32_i32$1 = 65535;
  i64toi32_i32$3 = -1;
  i64toi32_i32$1 = i64toi32_i32$0 & i64toi32_i32$1 | 0;
  $7_1 = i64toi32_i32$2 & i64toi32_i32$3 | 0;
  $7$hi = i64toi32_i32$1;
  block3 : {
   block : {
    i64toi32_i32$1 = i64toi32_i32$0;
    i64toi32_i32$1 = i64toi32_i32$0;
    i64toi32_i32$0 = i64toi32_i32$2;
    i64toi32_i32$2 = 0;
    i64toi32_i32$3 = 48;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = 0;
     $47_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
     $47_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
    }
    i64toi32_i32$1 = $47_1;
    i64toi32_i32$0 = 0;
    i64toi32_i32$3 = 32767;
    i64toi32_i32$0 = i64toi32_i32$2 & i64toi32_i32$0 | 0;
    $8_1 = i64toi32_i32$1 & i64toi32_i32$3 | 0;
    $8$hi = i64toi32_i32$0;
    $3_1 = $8_1;
    if (($3_1 + -15361 | 0) >>> 0 > 2045 >>> 0) {
     break block
    }
    i64toi32_i32$0 = $0$hi;
    i64toi32_i32$2 = $0_1;
    i64toi32_i32$1 = 0;
    i64toi32_i32$3 = 60;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = 0;
     $48_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
     $48_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
    }
    $23_1 = $48_1;
    $23$hi = i64toi32_i32$1;
    i64toi32_i32$1 = $7$hi;
    i64toi32_i32$0 = $7_1;
    i64toi32_i32$2 = 0;
    i64toi32_i32$3 = 4;
    i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
     $49_1 = 0;
    } else {
     i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$0 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
     $49_1 = i64toi32_i32$0 << i64toi32_i32$4 | 0;
    }
    $25$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $23$hi;
    i64toi32_i32$1 = $23_1;
    i64toi32_i32$0 = $25$hi;
    i64toi32_i32$3 = $49_1;
    i64toi32_i32$0 = i64toi32_i32$2 | i64toi32_i32$0 | 0;
    $7_1 = i64toi32_i32$1 | i64toi32_i32$3 | 0;
    $7$hi = i64toi32_i32$0;
    i64toi32_i32$0 = 0;
    $8_1 = $3_1 + -15360 | 0;
    $8$hi = i64toi32_i32$0;
    block2 : {
     block1 : {
      i64toi32_i32$0 = $0$hi;
      i64toi32_i32$2 = $0_1;
      i64toi32_i32$1 = 268435455;
      i64toi32_i32$3 = -1;
      i64toi32_i32$1 = i64toi32_i32$0 & i64toi32_i32$1 | 0;
      $0_1 = i64toi32_i32$2 & i64toi32_i32$3 | 0;
      $0$hi = i64toi32_i32$1;
      i64toi32_i32$0 = $0_1;
      i64toi32_i32$2 = 134217728;
      i64toi32_i32$3 = 1;
      if (i64toi32_i32$1 >>> 0 < i64toi32_i32$2 >>> 0 | ((i64toi32_i32$1 | 0) == (i64toi32_i32$2 | 0) & i64toi32_i32$0 >>> 0 < i64toi32_i32$3 >>> 0 | 0) | 0) {
       break block1
      }
      i64toi32_i32$0 = $7$hi;
      i64toi32_i32$3 = $7_1;
      i64toi32_i32$1 = 0;
      i64toi32_i32$2 = 1;
      i64toi32_i32$4 = i64toi32_i32$3 + i64toi32_i32$2 | 0;
      i64toi32_i32$5 = i64toi32_i32$0 + i64toi32_i32$1 | 0;
      if (i64toi32_i32$4 >>> 0 < i64toi32_i32$2 >>> 0) {
       i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
      }
      $7_1 = i64toi32_i32$4;
      $7$hi = i64toi32_i32$5;
      break block2;
     }
     i64toi32_i32$5 = $0$hi;
     i64toi32_i32$0 = $0_1;
     i64toi32_i32$3 = 134217728;
     i64toi32_i32$2 = 0;
     if ((i64toi32_i32$0 | 0) != (i64toi32_i32$2 | 0) | (i64toi32_i32$5 | 0) != (i64toi32_i32$3 | 0) | 0) {
      break block2
     }
     i64toi32_i32$0 = $7$hi;
     i64toi32_i32$2 = $7_1;
     i64toi32_i32$5 = 0;
     i64toi32_i32$3 = 1;
     i64toi32_i32$5 = i64toi32_i32$0 & i64toi32_i32$5 | 0;
     $39$hi = i64toi32_i32$5;
     i64toi32_i32$5 = i64toi32_i32$0;
     i64toi32_i32$5 = $39$hi;
     i64toi32_i32$0 = i64toi32_i32$2 & i64toi32_i32$3 | 0;
     i64toi32_i32$2 = $7$hi;
     i64toi32_i32$3 = $7_1;
     i64toi32_i32$1 = i64toi32_i32$0 + i64toi32_i32$3 | 0;
     i64toi32_i32$4 = i64toi32_i32$5 + i64toi32_i32$2 | 0;
     if (i64toi32_i32$1 >>> 0 < i64toi32_i32$3 >>> 0) {
      i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
     }
     $7_1 = i64toi32_i32$1;
     $7$hi = i64toi32_i32$4;
    }
    i64toi32_i32$4 = $7$hi;
    i64toi32_i32$5 = $7_1;
    i64toi32_i32$0 = 1048575;
    i64toi32_i32$3 = -1;
    $3_1 = i64toi32_i32$4 >>> 0 > i64toi32_i32$0 >>> 0 | ((i64toi32_i32$4 | 0) == (i64toi32_i32$0 | 0) & i64toi32_i32$5 >>> 0 > i64toi32_i32$3 >>> 0 | 0) | 0;
    i64toi32_i32$2 = $3_1;
    i64toi32_i32$5 = 0;
    i64toi32_i32$0 = i64toi32_i32$2 ? 0 : $7_1;
    i64toi32_i32$3 = i64toi32_i32$2 ? i64toi32_i32$5 : i64toi32_i32$4;
    $0_1 = i64toi32_i32$0;
    $0$hi = i64toi32_i32$3;
    i64toi32_i32$3 = 0;
    $48$hi = i64toi32_i32$3;
    i64toi32_i32$3 = $8$hi;
    i64toi32_i32$3 = $48$hi;
    i64toi32_i32$0 = $8$hi;
    i64toi32_i32$5 = $8_1;
    i64toi32_i32$4 = i64toi32_i32$2 + i64toi32_i32$5 | 0;
    i64toi32_i32$1 = i64toi32_i32$3 + i64toi32_i32$0 | 0;
    if (i64toi32_i32$4 >>> 0 < i64toi32_i32$5 >>> 0) {
     i64toi32_i32$1 = i64toi32_i32$1 + 1 | 0
    }
    $7_1 = i64toi32_i32$4;
    $7$hi = i64toi32_i32$1;
    break block3;
   }
   block4 : {
    i64toi32_i32$1 = $0$hi;
    i64toi32_i32$1 = $7$hi;
    i64toi32_i32$1 = $0$hi;
    i64toi32_i32$3 = $0_1;
    i64toi32_i32$2 = $7$hi;
    i64toi32_i32$5 = $7_1;
    i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
    if (!(i64toi32_i32$3 | i64toi32_i32$5 | 0 | i64toi32_i32$2 | 0)) {
     break block4
    }
    i64toi32_i32$2 = $8$hi;
    i64toi32_i32$1 = $8_1;
    i64toi32_i32$3 = 0;
    i64toi32_i32$5 = 32767;
    if ((i64toi32_i32$1 | 0) != (i64toi32_i32$5 | 0) | (i64toi32_i32$2 | 0) != (i64toi32_i32$3 | 0) | 0) {
     break block4
    }
    i64toi32_i32$1 = $0$hi;
    i64toi32_i32$5 = $0_1;
    i64toi32_i32$2 = 0;
    i64toi32_i32$3 = 60;
    i64toi32_i32$0 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = 0;
     $50_1 = i64toi32_i32$1 >>> i64toi32_i32$0 | 0;
    } else {
     i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$0 | 0;
     $50_1 = (((1 << i64toi32_i32$0 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$0 | 0) | 0 | (i64toi32_i32$5 >>> i64toi32_i32$0 | 0) | 0;
    }
    $58_1 = $50_1;
    $58$hi = i64toi32_i32$2;
    i64toi32_i32$2 = $7$hi;
    i64toi32_i32$1 = $7_1;
    i64toi32_i32$5 = 0;
    i64toi32_i32$3 = 4;
    i64toi32_i32$0 = i64toi32_i32$3 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
     i64toi32_i32$5 = i64toi32_i32$1 << i64toi32_i32$0 | 0;
     $51 = 0;
    } else {
     i64toi32_i32$5 = ((1 << i64toi32_i32$0 | 0) - 1 | 0) & (i64toi32_i32$1 >>> (32 - i64toi32_i32$0 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$0 | 0) | 0;
     $51 = i64toi32_i32$1 << i64toi32_i32$0 | 0;
    }
    $60$hi = i64toi32_i32$5;
    i64toi32_i32$5 = $58$hi;
    i64toi32_i32$2 = $58_1;
    i64toi32_i32$1 = $60$hi;
    i64toi32_i32$3 = $51;
    i64toi32_i32$1 = i64toi32_i32$5 | i64toi32_i32$1 | 0;
    i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
    i64toi32_i32$2 = 524288;
    i64toi32_i32$3 = 0;
    i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
    $0_1 = i64toi32_i32$5 | i64toi32_i32$3 | 0;
    $0$hi = i64toi32_i32$2;
    i64toi32_i32$2 = 0;
    $7_1 = 2047;
    $7$hi = i64toi32_i32$2;
    break block3;
   }
   block5 : {
    if ($3_1 >>> 0 <= 17406 >>> 0) {
     break block5
    }
    i64toi32_i32$2 = 0;
    $7_1 = 2047;
    $7$hi = i64toi32_i32$2;
    i64toi32_i32$2 = 0;
    $0_1 = 0;
    $0$hi = i64toi32_i32$2;
    break block3;
   }
   block6 : {
    i64toi32_i32$2 = $8$hi;
    $4_1 = !($8_1 | i64toi32_i32$2 | 0);
    $5_1 = $4_1 ? 15360 : 15361;
    $6_1 = $5_1 - $3_1 | 0;
    if (($6_1 | 0) <= (112 | 0)) {
     break block6
    }
    i64toi32_i32$2 = 0;
    $0_1 = 0;
    $0$hi = i64toi32_i32$2;
    i64toi32_i32$2 = 0;
    $7_1 = 0;
    $7$hi = i64toi32_i32$2;
    break block3;
   }
   i64toi32_i32$2 = $0$hi;
   i64toi32_i32$2 = $7$hi;
   i64toi32_i32$1 = $7_1;
   i64toi32_i32$5 = 65536;
   i64toi32_i32$3 = 0;
   i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
   $79 = i64toi32_i32$1 | i64toi32_i32$3 | 0;
   $79$hi = i64toi32_i32$5;
   i64toi32_i32$0 = $4_1;
   i64toi32_i32$5 = i64toi32_i32$2;
   i64toi32_i32$1 = $79$hi;
   i64toi32_i32$3 = i64toi32_i32$0 ? $7_1 : $79;
   i64toi32_i32$2 = i64toi32_i32$0 ? i64toi32_i32$2 : i64toi32_i32$1;
   $7_1 = i64toi32_i32$3;
   $7$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $0$hi;
   i64toi32_i32$3 = $7$hi;
   $47($2_1 + 16 | 0 | 0, $0_1 | 0, i64toi32_i32$2 | 0, $7_1 | 0, i64toi32_i32$3 | 0, 128 - $6_1 | 0 | 0);
   i64toi32_i32$3 = i64toi32_i32$2;
   i64toi32_i32$3 = $7$hi;
   i64toi32_i32$3 = i64toi32_i32$2;
   i64toi32_i32$2 = $7$hi;
   $48($2_1 | 0, $0_1 | 0, i64toi32_i32$3 | 0, $7_1 | 0, i64toi32_i32$2 | 0, $6_1 | 0);
   i64toi32_i32$2 = $88($2_1 | 0, 0 | 0) | 0;
   i64toi32_i32$3 = i64toi32_i32$HIGH_BITS;
   $7_1 = i64toi32_i32$2;
   $7$hi = i64toi32_i32$3;
   i64toi32_i32$0 = i64toi32_i32$2;
   i64toi32_i32$2 = 0;
   i64toi32_i32$5 = 60;
   i64toi32_i32$1 = i64toi32_i32$5 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$5 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = 0;
    $52_1 = i64toi32_i32$3 >>> i64toi32_i32$1 | 0;
   } else {
    i64toi32_i32$2 = i64toi32_i32$3 >>> i64toi32_i32$1 | 0;
    $52_1 = (((1 << i64toi32_i32$1 | 0) - 1 | 0) & i64toi32_i32$3 | 0) << (32 - i64toi32_i32$1 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$1 | 0) | 0;
   }
   $92 = $52_1;
   $92$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $88($2_1 + 8 | 0 | 0, 0 | 0) | 0;
   i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
   i64toi32_i32$3 = i64toi32_i32$2;
   i64toi32_i32$2 = 0;
   i64toi32_i32$5 = 4;
   i64toi32_i32$1 = i64toi32_i32$5 & 31 | 0;
   if (32 >>> 0 <= (i64toi32_i32$5 & 63 | 0) >>> 0) {
    i64toi32_i32$2 = i64toi32_i32$3 << i64toi32_i32$1 | 0;
    $53_1 = 0;
   } else {
    i64toi32_i32$2 = ((1 << i64toi32_i32$1 | 0) - 1 | 0) & (i64toi32_i32$3 >>> (32 - i64toi32_i32$1 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$1 | 0) | 0;
    $53_1 = i64toi32_i32$3 << i64toi32_i32$1 | 0;
   }
   $96$hi = i64toi32_i32$2;
   i64toi32_i32$2 = $92$hi;
   i64toi32_i32$0 = $92;
   i64toi32_i32$3 = $96$hi;
   i64toi32_i32$5 = $53_1;
   i64toi32_i32$3 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
   $0_1 = i64toi32_i32$0 | i64toi32_i32$5 | 0;
   $0$hi = i64toi32_i32$3;
   block8 : {
    block7 : {
     i64toi32_i32$3 = $7$hi;
     i64toi32_i32$2 = $7_1;
     i64toi32_i32$0 = 268435455;
     i64toi32_i32$5 = -1;
     i64toi32_i32$0 = i64toi32_i32$3 & i64toi32_i32$0 | 0;
     $99 = i64toi32_i32$2 & i64toi32_i32$5 | 0;
     $99$hi = i64toi32_i32$0;
     i64toi32_i32$0 = $88($2_1 | 0, 16 | 0) | 0;
     i64toi32_i32$2 = i64toi32_i32$HIGH_BITS;
     $104 = i64toi32_i32$0;
     $104$hi = i64toi32_i32$2;
     i64toi32_i32$2 = $88(($2_1 + 16 | 0) + 8 | 0 | 0, 0 | 0) | 0;
     i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
     $108 = i64toi32_i32$2;
     $108$hi = i64toi32_i32$0;
     i64toi32_i32$0 = $104$hi;
     i64toi32_i32$3 = $104;
     i64toi32_i32$2 = $108$hi;
     i64toi32_i32$5 = $108;
     i64toi32_i32$2 = i64toi32_i32$0 | i64toi32_i32$2 | 0;
     i64toi32_i32$0 = i64toi32_i32$3 | i64toi32_i32$5 | 0;
     i64toi32_i32$3 = 0;
     i64toi32_i32$5 = 0;
     $111_1 = ($5_1 | 0) != ($3_1 | 0) & ((i64toi32_i32$0 | 0) != (i64toi32_i32$5 | 0) | (i64toi32_i32$2 | 0) != (i64toi32_i32$3 | 0) | 0) | 0;
     i64toi32_i32$0 = 0;
     $112$hi = i64toi32_i32$0;
     i64toi32_i32$0 = $99$hi;
     i64toi32_i32$5 = $99;
     i64toi32_i32$2 = $112$hi;
     i64toi32_i32$3 = $111_1;
     i64toi32_i32$2 = i64toi32_i32$0 | i64toi32_i32$2 | 0;
     $7_1 = i64toi32_i32$5 | i64toi32_i32$3 | 0;
     $7$hi = i64toi32_i32$2;
     i64toi32_i32$0 = $7_1;
     i64toi32_i32$5 = 134217728;
     i64toi32_i32$3 = 1;
     if (i64toi32_i32$2 >>> 0 < i64toi32_i32$5 >>> 0 | ((i64toi32_i32$2 | 0) == (i64toi32_i32$5 | 0) & i64toi32_i32$0 >>> 0 < i64toi32_i32$3 >>> 0 | 0) | 0) {
      break block7
     }
     i64toi32_i32$0 = $0$hi;
     i64toi32_i32$3 = $0_1;
     i64toi32_i32$2 = 0;
     i64toi32_i32$5 = 1;
     i64toi32_i32$1 = i64toi32_i32$3 + i64toi32_i32$5 | 0;
     i64toi32_i32$4 = i64toi32_i32$0 + i64toi32_i32$2 | 0;
     if (i64toi32_i32$1 >>> 0 < i64toi32_i32$5 >>> 0) {
      i64toi32_i32$4 = i64toi32_i32$4 + 1 | 0
     }
     $0_1 = i64toi32_i32$1;
     $0$hi = i64toi32_i32$4;
     break block8;
    }
    i64toi32_i32$4 = $7$hi;
    i64toi32_i32$0 = $7_1;
    i64toi32_i32$3 = 134217728;
    i64toi32_i32$5 = 0;
    if ((i64toi32_i32$0 | 0) != (i64toi32_i32$5 | 0) | (i64toi32_i32$4 | 0) != (i64toi32_i32$3 | 0) | 0) {
     break block8
    }
    i64toi32_i32$0 = $0$hi;
    i64toi32_i32$5 = $0_1;
    i64toi32_i32$4 = 0;
    i64toi32_i32$3 = 1;
    i64toi32_i32$4 = i64toi32_i32$0 & i64toi32_i32$4 | 0;
    $121$hi = i64toi32_i32$4;
    i64toi32_i32$4 = i64toi32_i32$0;
    i64toi32_i32$4 = $121$hi;
    i64toi32_i32$0 = i64toi32_i32$5 & i64toi32_i32$3 | 0;
    i64toi32_i32$5 = $0$hi;
    i64toi32_i32$3 = $0_1;
    i64toi32_i32$2 = i64toi32_i32$0 + i64toi32_i32$3 | 0;
    i64toi32_i32$1 = i64toi32_i32$4 + i64toi32_i32$5 | 0;
    if (i64toi32_i32$2 >>> 0 < i64toi32_i32$3 >>> 0) {
     i64toi32_i32$1 = i64toi32_i32$1 + 1 | 0
    }
    $0_1 = i64toi32_i32$2;
    $0$hi = i64toi32_i32$1;
   }
   i64toi32_i32$1 = $0$hi;
   i64toi32_i32$4 = $0_1;
   i64toi32_i32$0 = 1048576;
   i64toi32_i32$3 = 0;
   i64toi32_i32$0 = i64toi32_i32$1 ^ i64toi32_i32$0 | 0;
   $125 = i64toi32_i32$4 ^ i64toi32_i32$3 | 0;
   $125$hi = i64toi32_i32$0;
   i64toi32_i32$0 = i64toi32_i32$1;
   i64toi32_i32$1 = i64toi32_i32$4;
   i64toi32_i32$4 = 1048575;
   i64toi32_i32$3 = -1;
   $3_1 = i64toi32_i32$0 >>> 0 > i64toi32_i32$4 >>> 0 | ((i64toi32_i32$0 | 0) == (i64toi32_i32$4 | 0) & i64toi32_i32$1 >>> 0 > i64toi32_i32$3 >>> 0 | 0) | 0;
   i64toi32_i32$5 = $3_1;
   i64toi32_i32$1 = $125$hi;
   i64toi32_i32$4 = i64toi32_i32$5 ? $125 : $0_1;
   i64toi32_i32$3 = i64toi32_i32$5 ? i64toi32_i32$1 : i64toi32_i32$0;
   $0_1 = i64toi32_i32$4;
   $0$hi = i64toi32_i32$3;
   i64toi32_i32$3 = 0;
   $7_1 = i64toi32_i32$5;
   $7$hi = i64toi32_i32$3;
  }
  global$0 = $2_1 + 32 | 0;
  i64toi32_i32$3 = $7$hi;
  i64toi32_i32$5 = $7_1;
  i64toi32_i32$4 = 0;
  i64toi32_i32$1 = 52;
  i64toi32_i32$0 = i64toi32_i32$1 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$1 & 63 | 0) >>> 0) {
   i64toi32_i32$4 = i64toi32_i32$5 << i64toi32_i32$0 | 0;
   $54_1 = 0;
  } else {
   i64toi32_i32$4 = ((1 << i64toi32_i32$0 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$0 | 0) | 0) | 0 | (i64toi32_i32$3 << i64toi32_i32$0 | 0) | 0;
   $54_1 = i64toi32_i32$5 << i64toi32_i32$0 | 0;
  }
  $136$hi = i64toi32_i32$4;
  i64toi32_i32$4 = $1$hi;
  i64toi32_i32$3 = $1_1;
  i64toi32_i32$5 = -2147483648;
  i64toi32_i32$1 = 0;
  i64toi32_i32$5 = i64toi32_i32$4 & i64toi32_i32$5 | 0;
  $138 = i64toi32_i32$3 & i64toi32_i32$1 | 0;
  $138$hi = i64toi32_i32$5;
  i64toi32_i32$5 = $136$hi;
  i64toi32_i32$4 = $54_1;
  i64toi32_i32$3 = $138$hi;
  i64toi32_i32$1 = $138;
  i64toi32_i32$3 = i64toi32_i32$5 | i64toi32_i32$3 | 0;
  $139$hi = i64toi32_i32$3;
  i64toi32_i32$3 = $0$hi;
  i64toi32_i32$3 = $139$hi;
  i64toi32_i32$5 = i64toi32_i32$4 | i64toi32_i32$1 | 0;
  i64toi32_i32$4 = $0$hi;
  i64toi32_i32$1 = $0_1;
  i64toi32_i32$4 = i64toi32_i32$3 | i64toi32_i32$4 | 0;
  wasm2js_scratch_store_i32(0 | 0, i64toi32_i32$5 | i64toi32_i32$1 | 0 | 0);
  wasm2js_scratch_store_i32(1 | 0, i64toi32_i32$4 | 0);
  return +(+wasm2js_scratch_load_f64());
 }
 
 function $50($0_1) {
  $0_1 = $0_1 | 0;
  global$1 = $0_1;
 }
 
 function $52() {
  global$3 = 65536;
  global$2 = (0 + 15 | 0) & -16 | 0;
 }
 
 function $53() {
  return global$0 - global$2 | 0 | 0;
 }
 
 function $54() {
  return global$3 | 0;
 }
 
 function $55() {
  return global$2 | 0;
 }
 
 function $56($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0, i64toi32_i32$1 = 0, $2_1 = 0, i64toi32_i32$0 = 0, $3_1 = 0;
  block : {
   if ($0_1) {
    break block
   }
   $1_1 = 0;
   block1 : {
    if (!($72(0 | 0, 68488 | 0) | 0)) {
     break block1
    }
    $1_1 = $56($72(0 | 0, 68488 | 0) | 0 | 0) | 0;
   }
   block2 : {
    if (!($72(0 | 0, 69536 | 0) | 0)) {
     break block2
    }
    $1_1 = $56($72(0 | 0, 69536 | 0) | 0 | 0) | 0 | $1_1 | 0;
   }
   block3 : {
    $0_1 = $72($12() | 0 | 0, 0 | 0) | 0;
    if (!$0_1) {
     break block3
    }
    label : while (1) {
     block5 : {
      block4 : {
       if (($72($0_1 | 0, 76 | 0) | 0 | 0) >= (0 | 0)) {
        break block4
       }
       $2_1 = 1;
       break block5;
      }
      $2_1 = !($8($0_1 | 0) | 0);
     }
     block6 : {
      if (($72($0_1 | 0, 20 | 0) | 0 | 0) == ($72($0_1 | 0, 28 | 0) | 0 | 0)) {
       break block6
      }
      $1_1 = $56($0_1 | 0) | 0 | $1_1 | 0;
     }
     block7 : {
      if ($2_1) {
       break block7
      }
      $9($0_1 | 0);
     }
     $0_1 = $72($0_1 | 0, 56 | 0) | 0;
     if ($0_1) {
      continue label
     }
     break label;
    };
   }
   $13();
   return $1_1 | 0;
  }
  block9 : {
   block8 : {
    if (($72($0_1 | 0, 76 | 0) | 0 | 0) >= (0 | 0)) {
     break block8
    }
    $2_1 = 1;
    break block9;
   }
   $2_1 = !($8($0_1 | 0) | 0);
  }
  block12 : {
   block11 : {
    block10 : {
     if (($72($0_1 | 0, 20 | 0) | 0 | 0) == ($72($0_1 | 0, 28 | 0) | 0 | 0)) {
      break block10
     }
     FUNCTION_TABLE[$72($0_1 | 0, 36 | 0) | 0 | 0]($0_1, 0, 0) | 0;
     if ($72($0_1 | 0, 20 | 0) | 0) {
      break block10
     }
     $1_1 = -1;
     if (!$2_1) {
      break block11
     }
     break block12;
    }
    block13 : {
     $1_1 = $72($0_1 | 0, 4 | 0) | 0;
     $3_1 = $72($0_1 | 0, 8 | 0) | 0;
     if (($1_1 | 0) == ($3_1 | 0)) {
      break block13
     }
     i64toi32_i32$1 = $1_1 - $3_1 | 0;
     i64toi32_i32$0 = i64toi32_i32$1 >> 31 | 0;
     i64toi32_i32$0 = FUNCTION_TABLE[$72($0_1 | 0, 40 | 0) | 0 | 0]($0_1, i64toi32_i32$1, i64toi32_i32$0, 1) | 0;
     i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
    }
    $1_1 = 0;
    $101($0_1 | 0, 28 | 0, 0 | 0);
    i64toi32_i32$1 = 0;
    $111($0_1 | 0, 16 | 0, 0 | 0, i64toi32_i32$1 | 0);
    i64toi32_i32$1 = 0;
    $110($0_1 | 0, 4 | 0, 0 | 0, i64toi32_i32$1 | 0);
    if ($2_1) {
     break block12
    }
   }
   $9($0_1 | 0);
  }
  return $1_1 | 0;
 }
 
 function $57($0_1) {
  $0_1 = $0_1 | 0;
  global$0 = $0_1;
 }
 
 function $58($0_1) {
  $0_1 = $0_1 | 0;
  var $1_1 = 0;
  $1_1 = (global$0 - $0_1 | 0) & -16 | 0;
  global$0 = $1_1;
  return $1_1 | 0;
 }
 
 function $59() {
  return global$0 | 0;
 }
 
 function $60($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  return ($69((($0_1 >>> 0 > 153 >>> 0 ? 0 : $0_1) << 1 | 0) + 68032 | 0 | 0, 0 | 0) | 0) + 66112 | 0 | 0;
 }
 
 function $61($0_1) {
  $0_1 = $0_1 | 0;
  return $60($0_1 | 0, $0_1 | 0) | 0 | 0;
 }
 
 function $62($0_1, $1_1, $2_1, $2$hi, $3_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $2$hi = $2$hi | 0;
  $3_1 = $3_1 | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  i64toi32_i32$0 = $2$hi;
  i64toi32_i32$0 = FUNCTION_TABLE[$0_1 | 0]($1_1, $2_1, i64toi32_i32$0, $3_1) | 0;
  i64toi32_i32$1 = i64toi32_i32$HIGH_BITS;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$0 | 0;
 }
 
 function $63($0_1, $1_1, $2_1, $3_1, $4_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $3_1 = $3_1 | 0;
  $4_1 = $4_1 | 0;
  var i64toi32_i32$2 = 0, i64toi32_i32$4 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, i64toi32_i32$3 = 0, $17_1 = 0, $18_1 = 0, $6_1 = 0, $7_1 = 0, $9_1 = 0, $9$hi = 0, $12$hi = 0, $5_1 = 0, $5$hi = 0;
  $6_1 = $0_1;
  $7_1 = $1_1;
  i64toi32_i32$0 = 0;
  $9_1 = $2_1;
  $9$hi = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  i64toi32_i32$2 = $3_1;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
   $17_1 = 0;
  } else {
   i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$0 << i64toi32_i32$4 | 0) | 0;
   $17_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
  }
  $12$hi = i64toi32_i32$1;
  i64toi32_i32$1 = $9$hi;
  i64toi32_i32$0 = $9_1;
  i64toi32_i32$2 = $12$hi;
  i64toi32_i32$3 = $17_1;
  i64toi32_i32$2 = i64toi32_i32$1 | i64toi32_i32$2 | 0;
  i64toi32_i32$2 = $62($6_1 | 0, $7_1 | 0, i64toi32_i32$0 | i64toi32_i32$3 | 0 | 0, i64toi32_i32$2 | 0, $4_1 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  $5_1 = i64toi32_i32$2;
  $5$hi = i64toi32_i32$0;
  i64toi32_i32$1 = i64toi32_i32$2;
  i64toi32_i32$2 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = 0;
   $18_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$2 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
   $18_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$1 >>> i64toi32_i32$4 | 0) | 0;
  }
  $50($18_1 | 0);
  i64toi32_i32$2 = $5$hi;
  return $5_1 | 0;
 }
 
 function $64($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = $0_1 + $1_1 | 0;
  if (($2_1 | 0) == (0 | 0) | (($2_1 + 1 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $2_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  return HEAP8[$2_1 >> 0] | 0 | 0;
 }
 
 function $65($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = $0_1 + $1_1 | 0;
  if (($2_1 | 0) == (0 | 0) | (($2_1 + 1 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $2_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  return HEAPU8[$2_1 >> 0] | 0 | 0;
 }
 
 function $69($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = $0_1 + $1_1 | 0;
  if (($2_1 | 0) == (0 | 0) | (($2_1 + 2 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $2_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  if ($2_1 & 1 | 0) {
   fimport$4()
  }
  return HEAPU16[$2_1 >> 1] | 0 | 0;
 }
 
 function $72($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = $0_1 + $1_1 | 0;
  if (($2_1 | 0) == (0 | 0) | (($2_1 + 4 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $2_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  if ($2_1 & 3 | 0) {
   fimport$4()
  }
  return HEAP32[$2_1 >> 2] | 0 | 0;
 }
 
 function $73($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  $2_1 = $0_1 + $1_1 | 0;
  if (($2_1 | 0) == (0 | 0) | (($2_1 + 1 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $2_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  i64toi32_i32$0 = HEAP8[$2_1 >> 0] | 0;
  i64toi32_i32$1 = i64toi32_i32$0 >> 31 | 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$0 | 0;
 }
 
 function $74($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  $2_1 = $0_1 + $1_1 | 0;
  if (($2_1 | 0) == (0 | 0) | (($2_1 + 1 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $2_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  i64toi32_i32$0 = HEAPU8[$2_1 >> 0] | 0;
  i64toi32_i32$1 = 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$0 | 0;
 }
 
 function $76($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  $2_1 = $0_1 + $1_1 | 0;
  if (($2_1 | 0) == (0 | 0) | (($2_1 + 2 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $2_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  if ($2_1 & 1 | 0) {
   fimport$4()
  }
  i64toi32_i32$0 = HEAP16[$2_1 >> 1] | 0;
  i64toi32_i32$1 = i64toi32_i32$0 >> 31 | 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$0 | 0;
 }
 
 function $78($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  $2_1 = $0_1 + $1_1 | 0;
  if (($2_1 | 0) == (0 | 0) | (($2_1 + 2 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $2_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  if ($2_1 & 1 | 0) {
   fimport$4()
  }
  i64toi32_i32$0 = HEAPU16[$2_1 >> 1] | 0;
  i64toi32_i32$1 = 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$0 | 0;
 }
 
 function $81($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  $2_1 = $0_1 + $1_1 | 0;
  if (($2_1 | 0) == (0 | 0) | (($2_1 + 4 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $2_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  if ($2_1 & 3 | 0) {
   fimport$4()
  }
  i64toi32_i32$0 = HEAP32[$2_1 >> 2] | 0;
  i64toi32_i32$1 = i64toi32_i32$0 >> 31 | 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$0 | 0;
 }
 
 function $84($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  $2_1 = $0_1 + $1_1 | 0;
  if (($2_1 | 0) == (0 | 0) | (($2_1 + 4 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $2_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  if ($2_1 & 3 | 0) {
   fimport$4()
  }
  i64toi32_i32$0 = HEAP32[$2_1 >> 2] | 0;
  i64toi32_i32$1 = 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$0 | 0;
 }
 
 function $87($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  $2_1 = $0_1 + $1_1 | 0;
  if (($2_1 | 0) == (0 | 0) | (($2_1 + 8 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $2_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  if ($2_1 & 3 | 0) {
   fimport$4()
  }
  i64toi32_i32$0 = HEAP32[$2_1 >> 2] | 0;
  i64toi32_i32$1 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$0 | 0;
 }
 
 function $88($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  $2_1 = $0_1 + $1_1 | 0;
  if (($2_1 | 0) == (0 | 0) | (($2_1 + 8 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $2_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  if ($2_1 & 7 | 0) {
   fimport$4()
  }
  i64toi32_i32$0 = HEAP32[$2_1 >> 2] | 0;
  i64toi32_i32$1 = HEAP32[($2_1 + 4 | 0) >> 2] | 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$0 | 0;
 }
 
 function $91($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = $0_1 + $1_1 | 0;
  if (($2_1 | 0) == (0 | 0) | (($2_1 + 4 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $2_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  if ($2_1 & 3 | 0) {
   fimport$4()
  }
  return Math_fround(Math_fround(HEAPF32[$2_1 >> 2]));
 }
 
 function $95($0_1, $1_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  var $2_1 = 0;
  $2_1 = $0_1 + $1_1 | 0;
  if (($2_1 | 0) == (0 | 0) | (($2_1 + 8 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $2_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  if ($2_1 & 7 | 0) {
   fimport$4()
  }
  return +(+HEAPF64[$2_1 >> 3]);
 }
 
 function $96($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0;
  $3_1 = $0_1 + $1_1 | 0;
  if (($3_1 | 0) == (0 | 0) | (($3_1 + 1 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $3_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  HEAP8[$3_1 >> 0] = $2_1;
 }
 
 function $98($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0;
  $3_1 = $0_1 + $1_1 | 0;
  if (($3_1 | 0) == (0 | 0) | (($3_1 + 2 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $3_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  if ($3_1 & 1 | 0) {
   fimport$4()
  }
  HEAP16[$3_1 >> 1] = $2_1;
 }
 
 function $101($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  var $3_1 = 0;
  $3_1 = $0_1 + $1_1 | 0;
  if (($3_1 | 0) == (0 | 0) | (($3_1 + 4 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $3_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  if ($3_1 & 3 | 0) {
   fimport$4()
  }
  HEAP32[$3_1 >> 2] = $2_1;
 }
 
 function $107($0_1, $1_1, $2_1, $2$hi) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $2$hi = $2$hi | 0;
  var $3_1 = 0;
  $3_1 = $0_1 + $1_1 | 0;
  if (($3_1 | 0) == (0 | 0) | (($3_1 + 4 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $3_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  if ($3_1 & 3 | 0) {
   fimport$4()
  }
  HEAP32[$3_1 >> 2] = $2_1;
 }
 
 function $110($0_1, $1_1, $2_1, $2$hi) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $2$hi = $2$hi | 0;
  var $3_1 = 0, i64toi32_i32$0 = 0;
  $3_1 = $0_1 + $1_1 | 0;
  if (($3_1 | 0) == (0 | 0) | (($3_1 + 8 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $3_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  if ($3_1 & 3 | 0) {
   fimport$4()
  }
  i64toi32_i32$0 = $2$hi;
  HEAP32[$3_1 >> 2] = $2_1;
  HEAP32[($3_1 + 4 | 0) >> 2] = i64toi32_i32$0;
 }
 
 function $111($0_1, $1_1, $2_1, $2$hi) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = $2_1 | 0;
  $2$hi = $2$hi | 0;
  var $3_1 = 0, i64toi32_i32$0 = 0;
  $3_1 = $0_1 + $1_1 | 0;
  if (($3_1 | 0) == (0 | 0) | (($3_1 + 8 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $3_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  if ($3_1 & 7 | 0) {
   fimport$4()
  }
  i64toi32_i32$0 = $2$hi;
  HEAP32[$3_1 >> 2] = $2_1;
  HEAP32[($3_1 + 4 | 0) >> 2] = i64toi32_i32$0;
 }
 
 function $118($0_1, $1_1, $2_1) {
  $0_1 = $0_1 | 0;
  $1_1 = $1_1 | 0;
  $2_1 = +$2_1;
  var $3_1 = 0;
  $3_1 = $0_1 + $1_1 | 0;
  if (($3_1 | 0) == (0 | 0) | (($3_1 + 8 | 0) >>> 0 > (HEAP32[($45() | 0) >> 2] | 0) >>> 0 | $3_1 >>> 0 < $0_1 >>> 0 | 0) | 0) {
   fimport$3();
   wasm2js_trap();
  }
  if ($3_1 & 7 | 0) {
   fimport$4()
  }
  HEAPF64[$3_1 >> 3] = $2_1;
 }
 
 function _ZN17compiler_builtins3int3mul3Mul3mul17h070e9a1c69faec5bE(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$4 = 0, i64toi32_i32$0 = 0, i64toi32_i32$1 = 0, var$2 = 0, i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, var$3 = 0, var$4 = 0, var$5 = 0, $21_1 = 0, $22_1 = 0, var$6 = 0, $24_1 = 0, $17_1 = 0, $18_1 = 0, $23_1 = 0, $29_1 = 0, $45_1 = 0, $56$hi = 0, $62$hi = 0;
  i64toi32_i32$0 = var$1$hi;
  var$2 = var$1;
  var$4 = var$2 >>> 16 | 0;
  i64toi32_i32$0 = var$0$hi;
  var$3 = var$0;
  var$5 = var$3 >>> 16 | 0;
  $17_1 = Math_imul(var$4, var$5);
  $18_1 = var$2;
  i64toi32_i32$2 = var$3;
  i64toi32_i32$1 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$1 = 0;
   $21_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
   $21_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
  }
  $23_1 = $17_1 + Math_imul($18_1, $21_1) | 0;
  i64toi32_i32$1 = var$1$hi;
  i64toi32_i32$0 = var$1;
  i64toi32_i32$2 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$2 = 0;
   $22_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
  } else {
   i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
   $22_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
  }
  $29_1 = $23_1 + Math_imul($22_1, var$3) | 0;
  var$2 = var$2 & 65535 | 0;
  var$3 = var$3 & 65535 | 0;
  var$6 = Math_imul(var$2, var$3);
  var$2 = (var$6 >>> 16 | 0) + Math_imul(var$2, var$5) | 0;
  $45_1 = $29_1 + (var$2 >>> 16 | 0) | 0;
  var$2 = (var$2 & 65535 | 0) + Math_imul(var$4, var$3) | 0;
  i64toi32_i32$2 = 0;
  i64toi32_i32$1 = $45_1 + (var$2 >>> 16 | 0) | 0;
  i64toi32_i32$0 = 0;
  i64toi32_i32$3 = 32;
  i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
  if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
   i64toi32_i32$0 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
   $24_1 = 0;
  } else {
   i64toi32_i32$0 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$1 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$2 << i64toi32_i32$4 | 0) | 0;
   $24_1 = i64toi32_i32$1 << i64toi32_i32$4 | 0;
  }
  $56$hi = i64toi32_i32$0;
  i64toi32_i32$0 = 0;
  $62$hi = i64toi32_i32$0;
  i64toi32_i32$0 = $56$hi;
  i64toi32_i32$2 = $24_1;
  i64toi32_i32$1 = $62$hi;
  i64toi32_i32$3 = var$2 << 16 | 0 | (var$6 & 65535 | 0) | 0;
  i64toi32_i32$1 = i64toi32_i32$0 | i64toi32_i32$1 | 0;
  i64toi32_i32$2 = i64toi32_i32$2 | i64toi32_i32$3 | 0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
  return i64toi32_i32$2 | 0;
 }
 
 function _ZN17compiler_builtins3int4udiv10divmod_u6417h6026910b5ed08e40E(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$2 = 0, i64toi32_i32$3 = 0, i64toi32_i32$4 = 0, i64toi32_i32$1 = 0, i64toi32_i32$0 = 0, i64toi32_i32$5 = 0, var$2 = 0, var$3 = 0, var$4 = 0, var$5 = 0, var$5$hi = 0, var$6 = 0, var$6$hi = 0, i64toi32_i32$6 = 0, $37_1 = 0, $38_1 = 0, $39_1 = 0, $40_1 = 0, $41_1 = 0, $42_1 = 0, $43_1 = 0, $44_1 = 0, var$8$hi = 0, $45_1 = 0, $46_1 = 0, $47_1 = 0, $48_1 = 0, var$7$hi = 0, $49_1 = 0, $63$hi = 0, $65_1 = 0, $65$hi = 0, $120$hi = 0, $129$hi = 0, $134$hi = 0, var$8 = 0, $140 = 0, $140$hi = 0, $142$hi = 0, $144 = 0, $144$hi = 0, $151 = 0, $151$hi = 0, $154$hi = 0, var$7 = 0, $165$hi = 0;
  label$1 : {
   label$2 : {
    label$3 : {
     label$4 : {
      label$5 : {
       label$6 : {
        label$7 : {
         label$8 : {
          label$9 : {
           label$10 : {
            label$11 : {
             i64toi32_i32$0 = var$0$hi;
             i64toi32_i32$2 = var$0;
             i64toi32_i32$1 = 0;
             i64toi32_i32$3 = 32;
             i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
             if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
              i64toi32_i32$1 = 0;
              $37_1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
             } else {
              i64toi32_i32$1 = i64toi32_i32$0 >>> i64toi32_i32$4 | 0;
              $37_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$0 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
             }
             var$2 = $37_1;
             if (var$2) {
              i64toi32_i32$1 = var$1$hi;
              var$3 = var$1;
              if (!var$3) {
               break label$11
              }
              i64toi32_i32$0 = var$3;
              i64toi32_i32$2 = 0;
              i64toi32_i32$3 = 32;
              i64toi32_i32$4 = i64toi32_i32$3 & 31 | 0;
              if (32 >>> 0 <= (i64toi32_i32$3 & 63 | 0) >>> 0) {
               i64toi32_i32$2 = 0;
               $38_1 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
              } else {
               i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$4 | 0;
               $38_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$0 >>> i64toi32_i32$4 | 0) | 0;
              }
              var$4 = $38_1;
              if (!var$4) {
               break label$9
              }
              var$2 = Math_clz32(var$4) - Math_clz32(var$2) | 0;
              if (var$2 >>> 0 <= 31 >>> 0) {
               break label$8
              }
              break label$2;
             }
             i64toi32_i32$2 = var$1$hi;
             i64toi32_i32$1 = var$1;
             i64toi32_i32$0 = 1;
             i64toi32_i32$3 = 0;
             if (i64toi32_i32$2 >>> 0 > i64toi32_i32$0 >>> 0 | ((i64toi32_i32$2 | 0) == (i64toi32_i32$0 | 0) & i64toi32_i32$1 >>> 0 >= i64toi32_i32$3 >>> 0 | 0) | 0) {
              break label$2
             }
             i64toi32_i32$1 = var$0$hi;
             var$2 = var$0;
             i64toi32_i32$1 = i64toi32_i32$2;
             i64toi32_i32$1 = i64toi32_i32$2;
             var$3 = var$1;
             var$2 = (var$2 >>> 0) / (var$3 >>> 0) | 0;
             i64toi32_i32$1 = 0;
             __wasm_intrinsics_temp_i64 = var$0 - Math_imul(var$2, var$3) | 0;
             __wasm_intrinsics_temp_i64$hi = i64toi32_i32$1;
             i64toi32_i32$1 = 0;
             i64toi32_i32$2 = var$2;
             i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
             return i64toi32_i32$2 | 0;
            }
            i64toi32_i32$2 = var$1$hi;
            i64toi32_i32$3 = var$1;
            i64toi32_i32$1 = 0;
            i64toi32_i32$0 = 32;
            i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
            if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
             i64toi32_i32$1 = 0;
             $39_1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
            } else {
             i64toi32_i32$1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
             $39_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$4 | 0) | 0;
            }
            var$3 = $39_1;
            i64toi32_i32$1 = var$0$hi;
            if (!var$0) {
             break label$7
            }
            if (!var$3) {
             break label$6
            }
            var$4 = var$3 + -1 | 0;
            if (var$4 & var$3 | 0) {
             break label$6
            }
            i64toi32_i32$1 = 0;
            i64toi32_i32$2 = var$4 & var$2 | 0;
            i64toi32_i32$3 = 0;
            i64toi32_i32$0 = 32;
            i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
            if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
             i64toi32_i32$3 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
             $40_1 = 0;
            } else {
             i64toi32_i32$3 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
             $40_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
            }
            $63$hi = i64toi32_i32$3;
            i64toi32_i32$3 = var$0$hi;
            i64toi32_i32$1 = var$0;
            i64toi32_i32$2 = 0;
            i64toi32_i32$0 = -1;
            i64toi32_i32$2 = i64toi32_i32$3 & i64toi32_i32$2 | 0;
            $65_1 = i64toi32_i32$1 & i64toi32_i32$0 | 0;
            $65$hi = i64toi32_i32$2;
            i64toi32_i32$2 = $63$hi;
            i64toi32_i32$3 = $40_1;
            i64toi32_i32$1 = $65$hi;
            i64toi32_i32$0 = $65_1;
            i64toi32_i32$1 = i64toi32_i32$2 | i64toi32_i32$1 | 0;
            __wasm_intrinsics_temp_i64 = i64toi32_i32$3 | i64toi32_i32$0 | 0;
            __wasm_intrinsics_temp_i64$hi = i64toi32_i32$1;
            i64toi32_i32$1 = 0;
            i64toi32_i32$3 = var$2 >>> ((__wasm_ctz_i32(var$3 | 0) | 0) & 31 | 0) | 0;
            i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
            return i64toi32_i32$3 | 0;
           }
          }
          var$4 = var$3 + -1 | 0;
          if (!(var$4 & var$3 | 0)) {
           break label$5
          }
          var$2 = (Math_clz32(var$3) + 33 | 0) - Math_clz32(var$2) | 0;
          var$3 = 0 - var$2 | 0;
          break label$3;
         }
         var$3 = 63 - var$2 | 0;
         var$2 = var$2 + 1 | 0;
         break label$3;
        }
        var$4 = (var$2 >>> 0) / (var$3 >>> 0) | 0;
        i64toi32_i32$3 = 0;
        i64toi32_i32$2 = var$2 - Math_imul(var$4, var$3) | 0;
        i64toi32_i32$1 = 0;
        i64toi32_i32$0 = 32;
        i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
        if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
         i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
         $41_1 = 0;
        } else {
         i64toi32_i32$1 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$3 << i64toi32_i32$4 | 0) | 0;
         $41_1 = i64toi32_i32$2 << i64toi32_i32$4 | 0;
        }
        __wasm_intrinsics_temp_i64 = $41_1;
        __wasm_intrinsics_temp_i64$hi = i64toi32_i32$1;
        i64toi32_i32$1 = 0;
        i64toi32_i32$2 = var$4;
        i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
        return i64toi32_i32$2 | 0;
       }
       var$2 = Math_clz32(var$3) - Math_clz32(var$2) | 0;
       if (var$2 >>> 0 < 31 >>> 0) {
        break label$4
       }
       break label$2;
      }
      i64toi32_i32$2 = var$0$hi;
      i64toi32_i32$2 = 0;
      __wasm_intrinsics_temp_i64 = var$4 & var$0 | 0;
      __wasm_intrinsics_temp_i64$hi = i64toi32_i32$2;
      if ((var$3 | 0) == (1 | 0)) {
       break label$1
      }
      i64toi32_i32$2 = var$0$hi;
      i64toi32_i32$2 = 0;
      $120$hi = i64toi32_i32$2;
      i64toi32_i32$2 = var$0$hi;
      i64toi32_i32$3 = var$0;
      i64toi32_i32$1 = $120$hi;
      i64toi32_i32$0 = __wasm_ctz_i32(var$3 | 0) | 0;
      i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
      if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
       i64toi32_i32$1 = 0;
       $42_1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
      } else {
       i64toi32_i32$1 = i64toi32_i32$2 >>> i64toi32_i32$4 | 0;
       $42_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$2 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$3 >>> i64toi32_i32$4 | 0) | 0;
      }
      i64toi32_i32$3 = $42_1;
      i64toi32_i32$HIGH_BITS = i64toi32_i32$1;
      return i64toi32_i32$3 | 0;
     }
     var$3 = 63 - var$2 | 0;
     var$2 = var$2 + 1 | 0;
    }
    i64toi32_i32$3 = var$0$hi;
    i64toi32_i32$3 = 0;
    $129$hi = i64toi32_i32$3;
    i64toi32_i32$3 = var$0$hi;
    i64toi32_i32$2 = var$0;
    i64toi32_i32$1 = $129$hi;
    i64toi32_i32$0 = var$2 & 63 | 0;
    i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
     i64toi32_i32$1 = 0;
     $43_1 = i64toi32_i32$3 >>> i64toi32_i32$4 | 0;
    } else {
     i64toi32_i32$1 = i64toi32_i32$3 >>> i64toi32_i32$4 | 0;
     $43_1 = (((1 << i64toi32_i32$4 | 0) - 1 | 0) & i64toi32_i32$3 | 0) << (32 - i64toi32_i32$4 | 0) | 0 | (i64toi32_i32$2 >>> i64toi32_i32$4 | 0) | 0;
    }
    var$5 = $43_1;
    var$5$hi = i64toi32_i32$1;
    i64toi32_i32$1 = var$0$hi;
    i64toi32_i32$1 = 0;
    $134$hi = i64toi32_i32$1;
    i64toi32_i32$1 = var$0$hi;
    i64toi32_i32$3 = var$0;
    i64toi32_i32$2 = $134$hi;
    i64toi32_i32$0 = var$3 & 63 | 0;
    i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = i64toi32_i32$3 << i64toi32_i32$4 | 0;
     $44_1 = 0;
    } else {
     i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$3 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$1 << i64toi32_i32$4 | 0) | 0;
     $44_1 = i64toi32_i32$3 << i64toi32_i32$4 | 0;
    }
    var$0 = $44_1;
    var$0$hi = i64toi32_i32$2;
    label$13 : {
     if (var$2) {
      i64toi32_i32$2 = var$1$hi;
      i64toi32_i32$1 = var$1;
      i64toi32_i32$3 = -1;
      i64toi32_i32$0 = -1;
      i64toi32_i32$4 = i64toi32_i32$1 + i64toi32_i32$0 | 0;
      i64toi32_i32$5 = i64toi32_i32$2 + i64toi32_i32$3 | 0;
      if (i64toi32_i32$4 >>> 0 < i64toi32_i32$0 >>> 0) {
       i64toi32_i32$5 = i64toi32_i32$5 + 1 | 0
      }
      var$8 = i64toi32_i32$4;
      var$8$hi = i64toi32_i32$5;
      label$15 : while (1) {
       i64toi32_i32$5 = var$5$hi;
       i64toi32_i32$2 = var$5;
       i64toi32_i32$1 = 0;
       i64toi32_i32$0 = 1;
       i64toi32_i32$3 = i64toi32_i32$0 & 31 | 0;
       if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
        i64toi32_i32$1 = i64toi32_i32$2 << i64toi32_i32$3 | 0;
        $45_1 = 0;
       } else {
        i64toi32_i32$1 = ((1 << i64toi32_i32$3 | 0) - 1 | 0) & (i64toi32_i32$2 >>> (32 - i64toi32_i32$3 | 0) | 0) | 0 | (i64toi32_i32$5 << i64toi32_i32$3 | 0) | 0;
        $45_1 = i64toi32_i32$2 << i64toi32_i32$3 | 0;
       }
       $140 = $45_1;
       $140$hi = i64toi32_i32$1;
       i64toi32_i32$1 = var$0$hi;
       i64toi32_i32$5 = var$0;
       i64toi32_i32$2 = 0;
       i64toi32_i32$0 = 63;
       i64toi32_i32$3 = i64toi32_i32$0 & 31 | 0;
       if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
        i64toi32_i32$2 = 0;
        $46_1 = i64toi32_i32$1 >>> i64toi32_i32$3 | 0;
       } else {
        i64toi32_i32$2 = i64toi32_i32$1 >>> i64toi32_i32$3 | 0;
        $46_1 = (((1 << i64toi32_i32$3 | 0) - 1 | 0) & i64toi32_i32$1 | 0) << (32 - i64toi32_i32$3 | 0) | 0 | (i64toi32_i32$5 >>> i64toi32_i32$3 | 0) | 0;
       }
       $142$hi = i64toi32_i32$2;
       i64toi32_i32$2 = $140$hi;
       i64toi32_i32$1 = $140;
       i64toi32_i32$5 = $142$hi;
       i64toi32_i32$0 = $46_1;
       i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
       var$5 = i64toi32_i32$1 | i64toi32_i32$0 | 0;
       var$5$hi = i64toi32_i32$5;
       $144 = var$5;
       $144$hi = i64toi32_i32$5;
       i64toi32_i32$5 = var$8$hi;
       i64toi32_i32$5 = var$5$hi;
       i64toi32_i32$5 = var$8$hi;
       i64toi32_i32$2 = var$8;
       i64toi32_i32$1 = var$5$hi;
       i64toi32_i32$0 = var$5;
       i64toi32_i32$3 = i64toi32_i32$2 - i64toi32_i32$0 | 0;
       i64toi32_i32$6 = i64toi32_i32$2 >>> 0 < i64toi32_i32$0 >>> 0;
       i64toi32_i32$4 = i64toi32_i32$6 + i64toi32_i32$1 | 0;
       i64toi32_i32$4 = i64toi32_i32$5 - i64toi32_i32$4 | 0;
       i64toi32_i32$5 = i64toi32_i32$3;
       i64toi32_i32$2 = 0;
       i64toi32_i32$0 = 63;
       i64toi32_i32$1 = i64toi32_i32$0 & 31 | 0;
       if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
        i64toi32_i32$2 = i64toi32_i32$4 >> 31 | 0;
        $47_1 = i64toi32_i32$4 >> i64toi32_i32$1 | 0;
       } else {
        i64toi32_i32$2 = i64toi32_i32$4 >> i64toi32_i32$1 | 0;
        $47_1 = (((1 << i64toi32_i32$1 | 0) - 1 | 0) & i64toi32_i32$4 | 0) << (32 - i64toi32_i32$1 | 0) | 0 | (i64toi32_i32$5 >>> i64toi32_i32$1 | 0) | 0;
       }
       var$6 = $47_1;
       var$6$hi = i64toi32_i32$2;
       i64toi32_i32$2 = var$1$hi;
       i64toi32_i32$2 = var$6$hi;
       i64toi32_i32$4 = var$6;
       i64toi32_i32$5 = var$1$hi;
       i64toi32_i32$0 = var$1;
       i64toi32_i32$5 = i64toi32_i32$2 & i64toi32_i32$5 | 0;
       $151 = i64toi32_i32$4 & i64toi32_i32$0 | 0;
       $151$hi = i64toi32_i32$5;
       i64toi32_i32$5 = $144$hi;
       i64toi32_i32$2 = $144;
       i64toi32_i32$4 = $151$hi;
       i64toi32_i32$0 = $151;
       i64toi32_i32$1 = i64toi32_i32$2 - i64toi32_i32$0 | 0;
       i64toi32_i32$6 = i64toi32_i32$2 >>> 0 < i64toi32_i32$0 >>> 0;
       i64toi32_i32$3 = i64toi32_i32$6 + i64toi32_i32$4 | 0;
       i64toi32_i32$3 = i64toi32_i32$5 - i64toi32_i32$3 | 0;
       var$5 = i64toi32_i32$1;
       var$5$hi = i64toi32_i32$3;
       i64toi32_i32$3 = var$0$hi;
       i64toi32_i32$5 = var$0;
       i64toi32_i32$2 = 0;
       i64toi32_i32$0 = 1;
       i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
       if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
        i64toi32_i32$2 = i64toi32_i32$5 << i64toi32_i32$4 | 0;
        $48_1 = 0;
       } else {
        i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$3 << i64toi32_i32$4 | 0) | 0;
        $48_1 = i64toi32_i32$5 << i64toi32_i32$4 | 0;
       }
       $154$hi = i64toi32_i32$2;
       i64toi32_i32$2 = var$7$hi;
       i64toi32_i32$2 = $154$hi;
       i64toi32_i32$3 = $48_1;
       i64toi32_i32$5 = var$7$hi;
       i64toi32_i32$0 = var$7;
       i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
       var$0 = i64toi32_i32$3 | i64toi32_i32$0 | 0;
       var$0$hi = i64toi32_i32$5;
       i64toi32_i32$5 = var$6$hi;
       i64toi32_i32$2 = var$6;
       i64toi32_i32$3 = 0;
       i64toi32_i32$0 = 1;
       i64toi32_i32$3 = i64toi32_i32$5 & i64toi32_i32$3 | 0;
       var$6 = i64toi32_i32$2 & i64toi32_i32$0 | 0;
       var$6$hi = i64toi32_i32$3;
       var$7 = var$6;
       var$7$hi = i64toi32_i32$3;
       var$2 = var$2 + -1 | 0;
       if (var$2) {
        continue label$15
       }
       break label$15;
      };
      break label$13;
     }
    }
    i64toi32_i32$3 = var$5$hi;
    __wasm_intrinsics_temp_i64 = var$5;
    __wasm_intrinsics_temp_i64$hi = i64toi32_i32$3;
    i64toi32_i32$3 = var$0$hi;
    i64toi32_i32$5 = var$0;
    i64toi32_i32$2 = 0;
    i64toi32_i32$0 = 1;
    i64toi32_i32$4 = i64toi32_i32$0 & 31 | 0;
    if (32 >>> 0 <= (i64toi32_i32$0 & 63 | 0) >>> 0) {
     i64toi32_i32$2 = i64toi32_i32$5 << i64toi32_i32$4 | 0;
     $49_1 = 0;
    } else {
     i64toi32_i32$2 = ((1 << i64toi32_i32$4 | 0) - 1 | 0) & (i64toi32_i32$5 >>> (32 - i64toi32_i32$4 | 0) | 0) | 0 | (i64toi32_i32$3 << i64toi32_i32$4 | 0) | 0;
     $49_1 = i64toi32_i32$5 << i64toi32_i32$4 | 0;
    }
    $165$hi = i64toi32_i32$2;
    i64toi32_i32$2 = var$6$hi;
    i64toi32_i32$2 = $165$hi;
    i64toi32_i32$3 = $49_1;
    i64toi32_i32$5 = var$6$hi;
    i64toi32_i32$0 = var$6;
    i64toi32_i32$5 = i64toi32_i32$2 | i64toi32_i32$5 | 0;
    i64toi32_i32$3 = i64toi32_i32$3 | i64toi32_i32$0 | 0;
    i64toi32_i32$HIGH_BITS = i64toi32_i32$5;
    return i64toi32_i32$3 | 0;
   }
   i64toi32_i32$3 = var$0$hi;
   __wasm_intrinsics_temp_i64 = var$0;
   __wasm_intrinsics_temp_i64$hi = i64toi32_i32$3;
   i64toi32_i32$3 = 0;
   var$0 = 0;
   var$0$hi = i64toi32_i32$3;
  }
  i64toi32_i32$3 = var$0$hi;
  i64toi32_i32$5 = var$0;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$3;
  return i64toi32_i32$5 | 0;
 }
 
 function __wasm_ctz_i32(var$0) {
  var$0 = var$0 | 0;
  if (var$0) {
   return 31 - Math_clz32((var$0 + -1 | 0) ^ var$0 | 0) | 0 | 0
  }
  return 32 | 0;
 }
 
 function __wasm_i64_mul(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$0 = var$1$hi;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$1 = var$1$hi;
  i64toi32_i32$1 = _ZN17compiler_builtins3int3mul3Mul3mul17h070e9a1c69faec5bE(var$0 | 0, i64toi32_i32$0 | 0, var$1 | 0, i64toi32_i32$1 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$0;
  return i64toi32_i32$1 | 0;
 }
 
 function __wasm_i64_udiv(var$0, var$0$hi, var$1, var$1$hi) {
  var$0 = var$0 | 0;
  var$0$hi = var$0$hi | 0;
  var$1 = var$1 | 0;
  var$1$hi = var$1$hi | 0;
  var i64toi32_i32$0 = 0, i64toi32_i32$1 = 0;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$0 = var$1$hi;
  i64toi32_i32$0 = var$0$hi;
  i64toi32_i32$1 = var$1$hi;
  i64toi32_i32$1 = _ZN17compiler_builtins3int4udiv10divmod_u6417h6026910b5ed08e40E(var$0 | 0, i64toi32_i32$0 | 0, var$1 | 0, i64toi32_i32$1 | 0) | 0;
  i64toi32_i32$0 = i64toi32_i32$HIGH_BITS;
  i64toi32_i32$HIGH_BITS = i64toi32_i32$0;
  return i64toi32_i32$1 | 0;
 }
 
 function __wasm_rotl_i32(var$0, var$1) {
  var$0 = var$0 | 0;
  var$1 = var$1 | 0;
  var var$2 = 0;
  var$2 = var$1 & 31 | 0;
  var$1 = (0 - var$1 | 0) & 31 | 0;
  return ((-1 >>> var$2 | 0) & var$0 | 0) << var$2 | 0 | (((-1 << var$1 | 0) & var$0 | 0) >>> var$1 | 0) | 0 | 0;
 }
 
 // EMSCRIPTEN_END_FUNCS
;
 bufferView = HEAPU8;
 initActiveSegments(imports);
 var FUNCTION_TABLE = Table([null, $5, $4, $6, $31, $32]);
 function __wasm_memory_size() {
  return buffer.byteLength / 65536 | 0;
 }
 
 return {
  "memory": Object.create(Object.prototype, {
   "grow": {
    
   }, 
   "buffer": {
    "get": function () {
     return buffer;
    }
    
   }
  }), 
  "__wasm_call_ctors": $0, 
  "main": $2, 
  "__indirect_function_table": FUNCTION_TABLE, 
  "fflush": $56, 
  "strerror": $61, 
  "sbrk": $46, 
  "emscripten_get_sbrk_ptr": $45, 
  "emscripten_stack_init": $52, 
  "emscripten_stack_get_free": $53, 
  "emscripten_stack_get_base": $54, 
  "emscripten_stack_get_end": $55, 
  "_emscripten_stack_restore": $57, 
  "_emscripten_stack_alloc": $58, 
  "emscripten_stack_get_current": $59, 
  "dynCall_jiji": $63
 };
}

  return asmFunc(info);
}

)(info);
  },
  instantiate: /** @suppress{checkTypes} */ function(binary, info) {
    return {
      then: function(ok) {
        var module = new WebAssembly.Module(binary);
        ok({
          "instance": new WebAssembly.Instance(module, info)
        });
        // Emulate a simple WebAssembly.instantiate(..).then(()=>{}).catch(()=>{}) syntax.
        return {
          catch: function() {}
        };
      }
    };
  },
  RuntimeError: Error,
  isWasm2js: true
};

// end include: wasm2js.js
if (WebAssembly.isWasm2js) {
  // We don't need to actually download a wasm binary, mark it as present but
  // empty.
  wasmBinary = [];
}

if (typeof WebAssembly != "object") {
  err("no native wasm support detected");
}

// include: runtime_safe_heap.js
/** @param {number|boolean=} isFloat */ function getSafeHeapType(bytes, isFloat) {
  switch (bytes) {
   case 1:
    return "i8";

   case 2:
    return "i16";

   case 4:
    return isFloat ? "float" : "i32";

   case 8:
    return isFloat ? "double" : "i64";

   default:
    abort(`getSafeHeapType() invalid bytes=${bytes}`);
  }
}

/** @param {number|boolean=} isFloat */ function SAFE_HEAP_STORE(dest, value, bytes, isFloat) {
  if (dest <= 0) abort(`segmentation fault storing ${bytes} bytes to address ${dest}`);
  if (dest % bytes !== 0) abort(`alignment error storing to address ${dest}, which was expected to be aligned to a multiple of ${bytes}`);
  if (runtimeInitialized) {
    var brk = _sbrk(0);
    if (dest + bytes > brk) abort(`segmentation fault, exceeded the top of the available dynamic heap when storing ${bytes} bytes to address ${dest}. DYNAMICTOP=${brk}`);
    if (brk < _emscripten_stack_get_base()) abort(`brk >= _emscripten_stack_get_base() (brk=${brk}, _emscripten_stack_get_base()=${_emscripten_stack_get_base()})`);
    // sbrk-managed memory must be above the stack
    if (brk > wasmMemory.buffer.byteLength) abort(`brk <= wasmMemory.buffer.byteLength (brk=${brk}, wasmMemory.buffer.byteLength=${wasmMemory.buffer.byteLength})`);
  }
  setValue_safe(dest, value, getSafeHeapType(bytes, isFloat));
  return value;
}

function SAFE_HEAP_STORE_D(dest, value, bytes) {
  return SAFE_HEAP_STORE(dest, value, bytes, true);
}

/** @param {number|boolean=} isFloat */ function SAFE_HEAP_LOAD(dest, bytes, unsigned, isFloat) {
  if (dest <= 0) abort(`segmentation fault loading ${bytes} bytes from address ${dest}`);
  if (dest % bytes !== 0) abort(`alignment error loading from address ${dest}, which was expected to be aligned to a multiple of ${bytes}`);
  if (runtimeInitialized) {
    var brk = _sbrk(0);
    if (dest + bytes > brk) abort(`segmentation fault, exceeded the top of the available dynamic heap when loading ${bytes} bytes from address ${dest}. DYNAMICTOP=${brk}`);
    if (brk < _emscripten_stack_get_base()) abort(`brk >= _emscripten_stack_get_base() (brk=${brk}, _emscripten_stack_get_base()=${_emscripten_stack_get_base()})`);
    // sbrk-managed memory must be above the stack
    if (brk > wasmMemory.buffer.byteLength) abort(`brk <= wasmMemory.buffer.byteLength (brk=${brk}, wasmMemory.buffer.byteLength=${wasmMemory.buffer.byteLength})`);
  }
  var type = getSafeHeapType(bytes, isFloat);
  var ret = getValue_safe(dest, type);
  if (unsigned) ret = unSign(ret, parseInt(type.substr(1), 10));
  return ret;
}

function SAFE_HEAP_LOAD_D(dest, bytes, unsigned) {
  return SAFE_HEAP_LOAD(dest, bytes, unsigned, true);
}

function SAFE_FT_MASK(value, mask) {
  var ret = value & mask;
  if (ret !== value) {
    abort(`Function table mask error: function pointer is ${value} which is masked by ${mask}, the likely cause of this is that the function pointer is being called by the wrong type.`);
  }
  return ret;
}

function segfault() {
  abort("segmentation fault");
}

function alignfault() {
  abort("alignment fault");
}

// end include: runtime_safe_heap.js
// Wasm globals
var wasmMemory;

//========================================
// Runtime essentials
//========================================
// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS;

// In STRICT mode, we only define assert() when ASSERTIONS is set.  i.e. we
// don't define it at all in release modes.  This matches the behaviour of
// MINIMAL_RUNTIME.
// TODO(sbc): Make this the default even without STRICT enabled.
/** @type {function(*, string=)} */ function assert(condition, text) {
  if (!condition) {
    abort("Assertion failed" + (text ? ": " + text : ""));
  }
}

// We used to include malloc/free by default in the past. Show a helpful error in
// builds with assertions.
function _malloc() {
  abort("malloc() called but not included in the build - add `_malloc` to EXPORTED_FUNCTIONS");
}

function _free() {
  // Show a helpful error since we used to include free by default in the past.
  abort("free() called but not included in the build - add `_free` to EXPORTED_FUNCTIONS");
}

// Memory management
var HEAP, /** @type {!Int8Array} */ HEAP8, /** @type {!Uint8Array} */ HEAPU8, /** @type {!Int16Array} */ HEAP16, /** @type {!Uint16Array} */ HEAPU16, /** @type {!Int32Array} */ HEAP32, /** @type {!Uint32Array} */ HEAPU32, /** @type {!Float32Array} */ HEAPF32, /** @type {!Float64Array} */ HEAPF64;

// include: runtime_shared.js
function updateMemoryViews() {
  var b = wasmMemory.buffer;
  Module["HEAP8"] = HEAP8 = new Int8Array(b);
  Module["HEAP16"] = HEAP16 = new Int16Array(b);
  Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
  Module["HEAPU16"] = HEAPU16 = new Uint16Array(b);
  Module["HEAP32"] = HEAP32 = new Int32Array(b);
  Module["HEAPU32"] = HEAPU32 = new Uint32Array(b);
  Module["HEAPF32"] = HEAPF32 = new Float32Array(b);
  Module["HEAPF64"] = HEAPF64 = new Float64Array(b);
}

// end include: runtime_shared.js
assert(!Module["STACK_SIZE"], "STACK_SIZE can no longer be set at runtime.  Use -sSTACK_SIZE at link time");

assert(typeof Int32Array != "undefined" && typeof Float64Array !== "undefined" && Int32Array.prototype.subarray != undefined && Int32Array.prototype.set != undefined, "JS engine does not provide full typed array support");

// If memory is defined in wasm, the user can't provide it, or set INITIAL_MEMORY
assert(!Module["wasmMemory"], "Use of `wasmMemory` detected.  Use -sIMPORTED_MEMORY to define wasmMemory externally");

assert(!Module["INITIAL_MEMORY"], "Detected runtime INITIAL_MEMORY setting.  Use -sIMPORTED_MEMORY to define wasmMemory dynamically");

// include: runtime_stack_check.js
// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  var max = _emscripten_stack_get_end();
  assert((max & 3) == 0);
  // If the stack ends at address zero we write our cookies 4 bytes into the
  // stack.  This prevents interference with SAFE_HEAP and ASAN which also
  // monitor writes to address zero.
  if (max == 0) {
    max += 4;
  }
  // The stack grow downwards towards _emscripten_stack_get_end.
  // We write cookies to the final two words in the stack and detect if they are
  // ever overwritten.
  SAFE_HEAP_STORE(((max) >> 2) * 4, 34821223, 4);
  SAFE_HEAP_STORE((((max) + (4)) >> 2) * 4, 2310721022, 4);
}

function checkStackCookie() {
  if (ABORT) return;
  var max = _emscripten_stack_get_end();
  // See writeStackCookie().
  if (max == 0) {
    max += 4;
  }
  var cookie1 = SAFE_HEAP_LOAD(((max) >> 2) * 4, 4, 1);
  var cookie2 = SAFE_HEAP_LOAD((((max) + (4)) >> 2) * 4, 4, 1);
  if (cookie1 != 34821223 || cookie2 != 2310721022) {
    abort(`Stack overflow! Stack cookie has been overwritten at ${ptrToString(max)}, expected hex dwords 0x89BACDFE and 0x2135467, but received ${ptrToString(cookie2)} ${ptrToString(cookie1)}`);
  }
}

// end include: runtime_stack_check.js
var __ATPRERUN__ = [];

// functions called before the runtime is initialized
var __ATINIT__ = [];

// functions called during startup
var __ATMAIN__ = [];

// functions called when main() is to be run
var __ATEXIT__ = [];

// functions called during shutdown
var __ATPOSTRUN__ = [];

// functions called after the main() is called
var runtimeInitialized = false;

function preRun() {
  if (Module["preRun"]) {
    if (typeof Module["preRun"] == "function") Module["preRun"] = [ Module["preRun"] ];
    while (Module["preRun"].length) {
      addOnPreRun(Module["preRun"].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function initRuntime() {
  assert(!runtimeInitialized);
  runtimeInitialized = true;
  checkStackCookie();
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function postRun() {
  checkStackCookie();
  if (Module["postRun"]) {
    if (typeof Module["postRun"] == "function") Module["postRun"] = [ Module["postRun"] ];
    while (Module["postRun"].length) {
      addOnPostRun(Module["postRun"].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// include: runtime_math.js
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/fround
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/clz32
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/trunc
assert(Math.imul, "This browser does not support Math.imul(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

assert(Math.fround, "This browser does not support Math.fround(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

assert(Math.clz32, "This browser does not support Math.clz32(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

assert(Math.trunc, "This browser does not support Math.trunc(), build with LEGACY_VM_SUPPORT or POLYFILL_OLD_MATH_FUNCTIONS to add in a polyfill");

// end include: runtime_math.js
// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;

var dependenciesFulfilled = null;

// overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

var runDependencyWatcher = null;

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
}

function addRunDependency(id) {
  runDependencies++;
  Module["monitorRunDependencies"]?.(runDependencies);
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval != "undefined") {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(() => {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err("still waiting on run dependencies:");
          }
          err(`dependency: ${dep}`);
        }
        if (shown) {
          err("(end of list)");
        }
      }, 1e4);
    }
  } else {
    err("warning: run dependency added without ID");
  }
}

function removeRunDependency(id) {
  runDependencies--;
  Module["monitorRunDependencies"]?.(runDependencies);
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err("warning: run dependency removed without ID");
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback();
    }
  }
}

/** @param {string|number=} what */ function abort(what) {
  Module["onAbort"]?.(what);
  what = "Aborted(" + what + ")";
  // TODO(sbc): Should we remove printing and leave it up to whoever
  // catches the exception?
  err(what);
  ABORT = true;
  // Use a wasm runtime error, because a JS error might be seen as a foreign
  // exception, which means we'd run destructors on it. We need the error to
  // simply make the program stop.
  // FIXME This approach does not work in Wasm EH because it currently does not assume
  // all RuntimeErrors are from traps; it decides whether a RuntimeError is from
  // a trap or not based on a hidden field within the object. So at the moment
  // we don't have a way of throwing a wasm trap from JS. TODO Make a JS API that
  // allows this in the wasm spec.
  // Suppress closure compiler warning here. Closure compiler's builtin extern
  // definition for WebAssembly.RuntimeError claims it takes no arguments even
  // though it can.
  // TODO(https://github.com/google/closure-compiler/pull/3913): Remove if/when upstream closure gets fixed.
  /** @suppress {checkTypes} */ var e = new WebAssembly.RuntimeError(what);
  // Throw the error whether or not MODULARIZE is set because abort is used
  // in code paths apart from instantiation where an exception is expected
  // to be thrown when abort is called.
  throw e;
}

// include: memoryprofiler.js
// end include: memoryprofiler.js
// show errors on likely calls to FS when it was not included
var FS = {
  error() {
    abort("Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with -sFORCE_FILESYSTEM");
  },
  init() {
    FS.error();
  },
  createDataFile() {
    FS.error();
  },
  createPreloadedFile() {
    FS.error();
  },
  createLazyFile() {
    FS.error();
  },
  open() {
    FS.error();
  },
  mkdev() {
    FS.error();
  },
  registerDevice() {
    FS.error();
  },
  analyzePath() {
    FS.error();
  },
  ErrnoError() {
    FS.error();
  }
};

Module["FS_createDataFile"] = FS.createDataFile;

Module["FS_createPreloadedFile"] = FS.createPreloadedFile;

// include: URIUtils.js
// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = "data:application/octet-stream;base64,";

/**
 * Indicates whether filename is a base64 data URI.
 * @noinline
 */ var isDataURI = filename => filename.startsWith(dataURIPrefix);

/**
 * Indicates whether filename is delivered via file protocol (as opposed to http/https)
 * @noinline
 */ var isFileURI = filename => filename.startsWith("file://");

// end include: URIUtils.js
function createExportWrapper(name, nargs) {
  return (...args) => {
    assert(runtimeInitialized, `native function \`${name}\` called before runtime initialization`);
    var f = wasmExports[name];
    assert(f, `exported native function \`${name}\` not found`);
    // Only assert for too many arguments. Too few can be valid since the missing arguments will be zero filled.
    assert(args.length <= nargs, `native function \`${name}\` called with ${args.length} args but expects ${nargs}`);
    return f(...args);
  };
}

// include: runtime_exceptions.js
// end include: runtime_exceptions.js
function findWasmBinary() {
  var f = "asm.wasm";
  if (!isDataURI(f)) {
    return locateFile(f);
  }
  return f;
}

var wasmBinaryFile;

function getBinarySync(file) {
  if (file == wasmBinaryFile && wasmBinary) {
    return new Uint8Array(wasmBinary);
  }
  if (readBinary) {
    return readBinary(file);
  }
  throw "both async and sync fetching of the wasm failed";
}

async function getWasmBinary(binaryFile) {
  // If we don't have the binary yet, load it asynchronously using readAsync.
  if (!wasmBinary) {
    // Fetch the binary using readAsync
    try {
      var response = await readAsync(binaryFile);
      return new Uint8Array(response);
    } catch {}
  }
  // Otherwise, getBinarySync should be able to get it synchronously
  return getBinarySync(binaryFile);
}

async function instantiateArrayBuffer(binaryFile, imports) {
  try {
    var binary = await getWasmBinary(binaryFile);
    var instance = await WebAssembly.instantiate(binary, imports);
    return instance;
  } catch (reason) {
    err(`failed to asynchronously prepare wasm: ${reason}`);
    // Warn on some common problems.
    if (isFileURI(wasmBinaryFile)) {
      err(`warning: Loading from a file URI (${wasmBinaryFile}) is not supported in most browsers. See https://emscripten.org/docs/getting_started/FAQ.html#how-do-i-run-a-local-webserver-for-testing-why-does-my-program-stall-in-downloading-or-preparing`);
    }
    abort(reason);
  }
}

async function instantiateAsync(binary, binaryFile, imports) {
  if (!binary && typeof WebAssembly.instantiateStreaming == "function" && !isDataURI(binaryFile) && // Don't use streaming for file:// delivered objects in a webview, fetch them synchronously.
  !isFileURI(binaryFile) && // Avoid instantiateStreaming() on Node.js environment for now, as while
  // Node.js v18.1.0 implements it, it does not have a full fetch()
  // implementation yet.
  // Reference:
  //   https://github.com/emscripten-core/emscripten/pull/16917
  !ENVIRONMENT_IS_NODE && typeof fetch == "function") {
    try {
      var response = fetch(binaryFile, {
        credentials: "same-origin"
      });
      var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
      return instantiationResult;
    } catch (reason) {
      // We expect the most common failure cause to be a bad MIME type for the binary,
      // in which case falling back to ArrayBuffer instantiation should work.
      err(`wasm streaming compile failed: ${reason}`);
      err("falling back to ArrayBuffer instantiation");
    }
  }
  return instantiateArrayBuffer(binaryFile, imports);
}

function getWasmImports() {
  // prepare imports
  return {
    "env": wasmImports,
    "wasi_snapshot_preview1": wasmImports
  };
}

// Create the wasm instance.
// Receives the wasm imports, returns the exports.
async function createWasm() {
  // Load the wasm module and create an instance of using native support in the JS engine.
  // handle a generated wasm instance, receiving its exports and
  // performing other necessary setup
  /** @param {WebAssembly.Module=} module*/ function receiveInstance(instance, module) {
    wasmExports = instance.exports;
    wasmMemory = wasmExports["memory"];
    assert(wasmMemory, "memory not found in wasm exports");
    updateMemoryViews();
    addOnInit(wasmExports["__wasm_call_ctors"]);
    removeRunDependency("wasm-instantiate");
    return wasmExports;
  }
  // wait for the pthread pool (if any)
  addRunDependency("wasm-instantiate");
  // Prefer streaming instantiation if available.
  // Async compilation can be confusing when an error on the page overwrites Module
  // (for example, if the order of elements is wrong, and the one defining Module is
  // later), so we save Module and check it later.
  var trueModule = Module;
  function receiveInstantiationResult(result) {
    // 'result' is a ResultObject object which has both the module and instance.
    // receiveInstance() will swap in the exports (to Module.asm) so they can be called
    assert(Module === trueModule, "the Module object should not be replaced during async compilation - perhaps the order of HTML elements is wrong?");
    trueModule = null;
    // TODO: Due to Closure regression https://github.com/google/closure-compiler/issues/3193, the above line no longer optimizes out down to the following line.
    // When the regression is fixed, can restore the above PTHREADS-enabled path.
    receiveInstance(result["instance"]);
  }
  var info = getWasmImports();
  // User shell pages can write their own Module.instantiateWasm = function(imports, successCallback) callback
  // to manually instantiate the Wasm module themselves. This allows pages to
  // run the instantiation parallel to any other async startup actions they are
  // performing.
  // Also pthreads and wasm workers initialize the wasm instance through this
  // path.
  if (Module["instantiateWasm"]) {
    try {
      return Module["instantiateWasm"](info, receiveInstance);
    } catch (e) {
      err(`Module.instantiateWasm callback failed with error: ${e}`);
      return false;
    }
  }
  wasmBinaryFile ??= findWasmBinary();
  var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
  receiveInstantiationResult(result);
  return result;
}

// Globals used by JS i64 conversions (see makeSetValue)
var tempDouble;

var tempI64;

// include: runtime_debug.js
// Endianness check
(() => {
  var h16 = new Int16Array(1);
  var h8 = new Int8Array(h16.buffer);
  h16[0] = 25459;
  if (h8[0] !== 115 || h8[1] !== 99) throw "Runtime error: expected the system to be little-endian! (Run with -sSUPPORT_BIG_ENDIAN to bypass)";
})();

if (Module["ENVIRONMENT"]) {
  throw new Error("Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -sENVIRONMENT=web or -sENVIRONMENT=node)");
}

function legacyModuleProp(prop, newName, incoming = true) {
  if (!Object.getOwnPropertyDescriptor(Module, prop)) {
    Object.defineProperty(Module, prop, {
      configurable: true,
      get() {
        let extra = incoming ? " (the initial value can be provided on Module, but after startup the value is only looked for on a local variable of that name)" : "";
        abort(`\`Module.${prop}\` has been replaced by \`${newName}\`` + extra);
      }
    });
  }
}

function ignoredModuleProp(prop) {
  if (Object.getOwnPropertyDescriptor(Module, prop)) {
    abort(`\`Module.${prop}\` was supplied but \`${prop}\` not included in INCOMING_MODULE_JS_API`);
  }
}

// forcing the filesystem exports a few things by default
function isExportedByForceFilesystem(name) {
  return name === "FS_createPath" || name === "FS_createDataFile" || name === "FS_createPreloadedFile" || name === "FS_unlink" || name === "addRunDependency" || // The old FS has some functionality that WasmFS lacks.
  name === "FS_createLazyFile" || name === "FS_createDevice" || name === "removeRunDependency";
}

/**
 * Intercept access to a global symbol.  This enables us to give informative
 * warnings/errors when folks attempt to use symbols they did not include in
 * their build, or no symbols that no longer exist.
 */ function hookGlobalSymbolAccess(sym, func) {
  if (typeof globalThis != "undefined" && !Object.getOwnPropertyDescriptor(globalThis, sym)) {
    Object.defineProperty(globalThis, sym, {
      configurable: true,
      get() {
        func();
        return undefined;
      }
    });
  }
}

function missingGlobal(sym, msg) {
  hookGlobalSymbolAccess(sym, () => {
    warnOnce(`\`${sym}\` is not longer defined by emscripten. ${msg}`);
  });
}

missingGlobal("buffer", "Please use HEAP8.buffer or wasmMemory.buffer");

missingGlobal("asm", "Please use wasmExports instead");

function missingLibrarySymbol(sym) {
  hookGlobalSymbolAccess(sym, () => {
    // Can't `abort()` here because it would break code that does runtime
    // checks.  e.g. `if (typeof SDL === 'undefined')`.
    var msg = `\`${sym}\` is a library symbol and not included by default; add it to your library.js __deps or to DEFAULT_LIBRARY_FUNCS_TO_INCLUDE on the command line`;
    // DEFAULT_LIBRARY_FUNCS_TO_INCLUDE requires the name as it appears in
    // library.js, which means $name for a JS name with no prefix, or name
    // for a JS name like _name.
    var librarySymbol = sym;
    if (!librarySymbol.startsWith("_")) {
      librarySymbol = "$" + sym;
    }
    msg += ` (e.g. -sDEFAULT_LIBRARY_FUNCS_TO_INCLUDE='${librarySymbol}')`;
    if (isExportedByForceFilesystem(sym)) {
      msg += ". Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you";
    }
    warnOnce(msg);
  });
  // Any symbol that is not included from the JS library is also (by definition)
  // not exported on the Module object.
  unexportedRuntimeSymbol(sym);
}

function unexportedRuntimeSymbol(sym) {
  if (!Object.getOwnPropertyDescriptor(Module, sym)) {
    Object.defineProperty(Module, sym, {
      configurable: true,
      get() {
        var msg = `'${sym}' was not exported. add it to EXPORTED_RUNTIME_METHODS (see the Emscripten FAQ)`;
        if (isExportedByForceFilesystem(sym)) {
          msg += ". Alternatively, forcing filesystem support (-sFORCE_FILESYSTEM) can export this for you";
        }
        abort(msg);
      }
    });
  }
}

// Used by XXXXX_DEBUG settings to output debug messages.
function dbg(...args) {
  // TODO(sbc): Make this configurable somehow.  Its not always convenient for
  // logging to show up as warnings.
  console.warn(...args);
}

// end include: runtime_debug.js
// === Body ===
// end include: preamble.js
class ExitStatus {
  name="ExitStatus";
  constructor(status) {
    this.message = `Program terminated with exit(${status})`;
    this.status = status;
  }
}

var callRuntimeCallbacks = callbacks => {
  while (callbacks.length > 0) {
    // Pass the module as the first argument.
    callbacks.shift()(Module);
  }
};

/**
     * @param {number} ptr
     * @param {string} type
     */ function getValue(ptr, type = "i8") {
  if (type.endsWith("*")) type = "*";
  switch (type) {
   case "i1":
    return SAFE_HEAP_LOAD(ptr, 1, 0);

   case "i8":
    return SAFE_HEAP_LOAD(ptr, 1, 0);

   case "i16":
    return SAFE_HEAP_LOAD(((ptr) >> 1) * 2, 2, 0);

   case "i32":
    return SAFE_HEAP_LOAD(((ptr) >> 2) * 4, 4, 0);

   case "i64":
    abort("to do getValue(i64) use WASM_BIGINT");

   case "float":
    return SAFE_HEAP_LOAD_D(((ptr) >> 2) * 4, 4, 0);

   case "double":
    return SAFE_HEAP_LOAD_D(((ptr) >> 3) * 8, 8, 0);

   case "*":
    return SAFE_HEAP_LOAD(((ptr) >> 2) * 4, 4, 1);

   default:
    abort(`invalid type for getValue: ${type}`);
  }
}

function getValue_safe(ptr, type = "i8") {
  if (type.endsWith("*")) type = "*";
  switch (type) {
   case "i1":
    return HEAP8[ptr];

   case "i8":
    return HEAP8[ptr];

   case "i16":
    return HEAP16[((ptr) >> 1)];

   case "i32":
    return HEAP32[((ptr) >> 2)];

   case "i64":
    abort("to do getValue(i64) use WASM_BIGINT");

   case "float":
    return HEAPF32[((ptr) >> 2)];

   case "double":
    return HEAPF64[((ptr) >> 3)];

   case "*":
    return HEAPU32[((ptr) >> 2)];

   default:
    abort(`invalid type for getValue: ${type}`);
  }
}

var noExitRuntime = Module["noExitRuntime"] || true;

var ptrToString = ptr => {
  assert(typeof ptr === "number");
  // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
  ptr >>>= 0;
  return "0x" + ptr.toString(16).padStart(8, "0");
};

/**
     * @param {number} ptr
     * @param {number} value
     * @param {string} type
     */ function setValue(ptr, value, type = "i8") {
  if (type.endsWith("*")) type = "*";
  switch (type) {
   case "i1":
    SAFE_HEAP_STORE(ptr, value, 1);
    break;

   case "i8":
    SAFE_HEAP_STORE(ptr, value, 1);
    break;

   case "i16":
    SAFE_HEAP_STORE(((ptr) >> 1) * 2, value, 2);
    break;

   case "i32":
    SAFE_HEAP_STORE(((ptr) >> 2) * 4, value, 4);
    break;

   case "i64":
    abort("to do setValue(i64) use WASM_BIGINT");

   case "float":
    SAFE_HEAP_STORE_D(((ptr) >> 2) * 4, value, 4);
    break;

   case "double":
    SAFE_HEAP_STORE_D(((ptr) >> 3) * 8, value, 8);
    break;

   case "*":
    SAFE_HEAP_STORE(((ptr) >> 2) * 4, value, 4);
    break;

   default:
    abort(`invalid type for setValue: ${type}`);
  }
}

function setValue_safe(ptr, value, type = "i8") {
  if (type.endsWith("*")) type = "*";
  switch (type) {
   case "i1":
    HEAP8[ptr] = value;
    break;

   case "i8":
    HEAP8[ptr] = value;
    break;

   case "i16":
    HEAP16[((ptr) >> 1)] = value;
    break;

   case "i32":
    HEAP32[((ptr) >> 2)] = value;
    break;

   case "i64":
    abort("to do setValue(i64) use WASM_BIGINT");

   case "float":
    HEAPF32[((ptr) >> 2)] = value;
    break;

   case "double":
    HEAPF64[((ptr) >> 3)] = value;
    break;

   case "*":
    HEAPU32[((ptr) >> 2)] = value;
    break;

   default:
    abort(`invalid type for setValue: ${type}`);
  }
}

var stackRestore = val => __emscripten_stack_restore(val);

var stackSave = () => _emscripten_stack_get_current();

var unSign = (value, bits) => {
  if (value >= 0) {
    return value;
  }
  // Need some trickery, since if bits == 32, we are right at the limit of the
  // bits JS uses in bitshifts
  return bits <= 32 ? 2 * Math.abs(1 << (bits - 1)) + value : Math.pow(2, bits) + value;
};

var warnOnce = text => {
  warnOnce.shown ||= {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    if (ENVIRONMENT_IS_NODE) text = "warning: " + text;
    err(text);
  }
};

var __emscripten_memcpy_js = (dest, src, num) => HEAPU8.copyWithin(dest, src, src + num);

var getHeapMax = () => HEAPU8.length;

var alignMemory = (size, alignment) => {
  assert(alignment, "alignment argument is required");
  return Math.ceil(size / alignment) * alignment;
};

var abortOnCannotGrowMemory = requestedSize => {
  abort(`Cannot enlarge memory arrays to size ${requestedSize} bytes (OOM). Either (1) compile with -sINITIAL_MEMORY=X with X higher than the current value ${HEAP8.length}, (2) compile with -sALLOW_MEMORY_GROWTH which allows increasing the size at runtime, or (3) if you want malloc to return NULL (0) instead of this abort, compile with -sABORTING_MALLOC=0`);
};

var _emscripten_resize_heap = requestedSize => {
  var oldSize = HEAPU8.length;
  // With CAN_ADDRESS_2GB or MEMORY64, pointers are already unsigned.
  requestedSize >>>= 0;
  abortOnCannotGrowMemory(requestedSize);
};

var printCharBuffers = [ null, [], [] ];

var UTF8Decoder = typeof TextDecoder != "undefined" ? new TextDecoder : undefined;

/**
     * Given a pointer 'idx' to a null-terminated UTF8-encoded string in the given
     * array that contains uint8 values, returns a copy of that string as a
     * Javascript String object.
     * heapOrArray is either a regular array, or a JavaScript typed array view.
     * @param {number=} idx
     * @param {number=} maxBytesToRead
     * @return {string}
     */ var UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead = NaN) => {
  var endIdx = idx + maxBytesToRead;
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on
  // null terminator by itself.  Also, use the length info to avoid running tiny
  // strings through TextDecoder, since .subarray() allocates garbage.
  // (As a tiny code save trick, compare endPtr against endIdx using a negation,
  // so that undefined/NaN means Infinity)
  while (heapOrArray[endPtr] && !(endPtr >= endIdx)) ++endPtr;
  if (endPtr - idx > 16 && heapOrArray.buffer && UTF8Decoder) {
    return UTF8Decoder.decode(heapOrArray.subarray(idx, endPtr));
  }
  var str = "";
  // If building with TextDecoder, we have already computed the string length
  // above, so test loop end condition against that
  while (idx < endPtr) {
    // For UTF8 byte structure, see:
    // http://en.wikipedia.org/wiki/UTF-8#Description
    // https://www.ietf.org/rfc/rfc2279.txt
    // https://tools.ietf.org/html/rfc3629
    var u0 = heapOrArray[idx++];
    if (!(u0 & 128)) {
      str += String.fromCharCode(u0);
      continue;
    }
    var u1 = heapOrArray[idx++] & 63;
    if ((u0 & 224) == 192) {
      str += String.fromCharCode(((u0 & 31) << 6) | u1);
      continue;
    }
    var u2 = heapOrArray[idx++] & 63;
    if ((u0 & 240) == 224) {
      u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
    } else {
      if ((u0 & 248) != 240) warnOnce("Invalid UTF-8 leading byte " + ptrToString(u0) + " encountered when deserializing a UTF-8 string in wasm memory to a JS string!");
      u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | (heapOrArray[idx++] & 63);
    }
    if (u0 < 65536) {
      str += String.fromCharCode(u0);
    } else {
      var ch = u0 - 65536;
      str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
    }
  }
  return str;
};

var printChar = (stream, curr) => {
  var buffer = printCharBuffers[stream];
  assert(buffer);
  if (curr === 0 || curr === 10) {
    (stream === 1 ? out : err)(UTF8ArrayToString(buffer));
    buffer.length = 0;
  } else {
    buffer.push(curr);
  }
};

var flush_NO_FILESYSTEM = () => {
  // flush anything remaining in the buffers during shutdown
  _fflush(0);
  if (printCharBuffers[1].length) printChar(1, 10);
  if (printCharBuffers[2].length) printChar(2, 10);
};

/**
     * Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the
     * emscripten HEAP, returns a copy of that string as a Javascript String object.
     *
     * @param {number} ptr
     * @param {number=} maxBytesToRead - An optional length that specifies the
     *   maximum number of bytes to read. You can omit this parameter to scan the
     *   string until the first 0 byte. If maxBytesToRead is passed, and the string
     *   at [ptr, ptr+maxBytesToReadr[ contains a null byte in the middle, then the
     *   string will cut short at that byte index (i.e. maxBytesToRead will not
     *   produce a string of exact length [ptr, ptr+maxBytesToRead[) N.B. mixing
     *   frequent uses of UTF8ToString() with and without maxBytesToRead may throw
     *   JS JIT optimizations off, so it is worth to consider consistently using one
     * @return {string}
     */ var UTF8ToString = (ptr, maxBytesToRead) => {
  assert(typeof ptr == "number", `UTF8ToString expects a number (got ${typeof ptr})`);
  return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
};

var SYSCALLS = {
  varargs: undefined,
  getStr(ptr) {
    var ret = UTF8ToString(ptr);
    return ret;
  }
};

var _fd_write = (fd, iov, iovcnt, pnum) => {
  // hack to support printf in SYSCALLS_REQUIRE_FILESYSTEM=0
  var num = 0;
  for (var i = 0; i < iovcnt; i++) {
    var ptr = SAFE_HEAP_LOAD(((iov) >> 2) * 4, 4, 1);
    var len = SAFE_HEAP_LOAD((((iov) + (4)) >> 2) * 4, 4, 1);
    iov += 8;
    for (var j = 0; j < len; j++) {
      printChar(fd, SAFE_HEAP_LOAD(ptr + j, 1, 1));
    }
    num += len;
  }
  SAFE_HEAP_STORE(((pnum) >> 2) * 4, num, 4);
  return 0;
};

var runtimeKeepaliveCounter = 0;

var keepRuntimeAlive = () => noExitRuntime || runtimeKeepaliveCounter > 0;

var _proc_exit = code => {
  EXITSTATUS = code;
  if (!keepRuntimeAlive()) {
    Module["onExit"]?.(code);
    ABORT = true;
  }
  quit_(code, new ExitStatus(code));
};

/** @param {boolean|number=} implicit */ var exitJS = (status, implicit) => {
  EXITSTATUS = status;
  checkUnflushedContent();
  // if exit() was called explicitly, warn the user if the runtime isn't actually being shut down
  if (keepRuntimeAlive() && !implicit) {
    var msg = `program exited (with status: ${status}), but keepRuntimeAlive() is set (counter=${runtimeKeepaliveCounter}) due to an async operation, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)`;
    err(msg);
  }
  _proc_exit(status);
};

var handleException = e => {
  // Certain exception types we do not treat as errors since they are used for
  // internal control flow.
  // 1. ExitStatus, which is thrown by exit()
  // 2. "unwind", which is thrown by emscripten_unwind_to_js_event_loop() and others
  //    that wish to return to JS event loop.
  if (e instanceof ExitStatus || e == "unwind") {
    return EXITSTATUS;
  }
  checkStackCookie();
  if (e instanceof WebAssembly.RuntimeError) {
    if (_emscripten_stack_get_current() <= 0) {
      err("Stack overflow detected.  You can try increasing -sSTACK_SIZE (currently set to 65536)");
    }
  }
  quit_(1, e);
};

function checkIncomingModuleAPI() {
  ignoredModuleProp("fetchSettings");
}

var wasmImports = {
  /** @export */ _emscripten_memcpy_js: __emscripten_memcpy_js,
  /** @export */ alignfault,
  /** @export */ emscripten_resize_heap: _emscripten_resize_heap,
  /** @export */ fd_write: _fd_write,
  /** @export */ segfault
};

var wasmExports;

createWasm();

var ___wasm_call_ctors = createExportWrapper("__wasm_call_ctors", 0);

var _main = Module["_main"] = createExportWrapper("main", 2);

var _fflush = createExportWrapper("fflush", 1);

var _strerror = createExportWrapper("strerror", 1);

var _sbrk = createExportWrapper("sbrk", 1);

var _emscripten_get_sbrk_ptr = createExportWrapper("emscripten_get_sbrk_ptr", 0);

var _emscripten_stack_init = () => (_emscripten_stack_init = wasmExports["emscripten_stack_init"])();

var _emscripten_stack_get_free = () => (_emscripten_stack_get_free = wasmExports["emscripten_stack_get_free"])();

var _emscripten_stack_get_base = () => (_emscripten_stack_get_base = wasmExports["emscripten_stack_get_base"])();

var _emscripten_stack_get_end = () => (_emscripten_stack_get_end = wasmExports["emscripten_stack_get_end"])();

var __emscripten_stack_restore = a0 => (__emscripten_stack_restore = wasmExports["_emscripten_stack_restore"])(a0);

var __emscripten_stack_alloc = a0 => (__emscripten_stack_alloc = wasmExports["_emscripten_stack_alloc"])(a0);

var _emscripten_stack_get_current = () => (_emscripten_stack_get_current = wasmExports["emscripten_stack_get_current"])();

var dynCall_jiji = Module["dynCall_jiji"] = createExportWrapper("dynCall_jiji", 5);

// include: postamble.js
// === Auto-generated postamble setup entry stuff ===
var missingLibrarySymbols = [ "writeI53ToI64", "writeI53ToI64Clamped", "writeI53ToI64Signaling", "writeI53ToU64Clamped", "writeI53ToU64Signaling", "readI53FromI64", "readI53FromU64", "convertI32PairToI53", "convertI32PairToI53Checked", "convertU32PairToI53", "stackAlloc", "getTempRet0", "setTempRet0", "zeroMemory", "growMemory", "strError", "inetPton4", "inetNtop4", "inetPton6", "inetNtop6", "readSockaddr", "writeSockaddr", "emscriptenLog", "readEmAsmArgs", "jstoi_q", "getExecutableName", "listenOnce", "autoResumeAudioContext", "dynCallLegacy", "getDynCaller", "dynCall", "runtimeKeepalivePush", "runtimeKeepalivePop", "callUserCallback", "maybeExit", "asmjsMangle", "asyncLoad", "mmapAlloc", "HandleAllocator", "getNativeTypeSize", "STACK_SIZE", "STACK_ALIGN", "POINTER_SIZE", "ASSERTIONS", "getCFunc", "ccall", "cwrap", "uleb128Encode", "sigToWasmTypes", "generateFuncType", "convertJsFunctionToWasm", "getEmptyTableSlot", "updateTableMap", "getFunctionAddress", "addFunction", "removeFunction", "reallyNegative", "strLen", "reSign", "formatString", "stringToUTF8Array", "stringToUTF8", "lengthBytesUTF8", "intArrayFromString", "intArrayToString", "AsciiToString", "stringToAscii", "UTF16ToString", "stringToUTF16", "lengthBytesUTF16", "UTF32ToString", "stringToUTF32", "lengthBytesUTF32", "stringToNewUTF8", "stringToUTF8OnStack", "writeArrayToMemory", "registerKeyEventCallback", "maybeCStringToJsString", "findEventTarget", "getBoundingClientRect", "fillMouseEventData", "registerMouseEventCallback", "registerWheelEventCallback", "registerUiEventCallback", "registerFocusEventCallback", "fillDeviceOrientationEventData", "registerDeviceOrientationEventCallback", "fillDeviceMotionEventData", "registerDeviceMotionEventCallback", "screenOrientation", "fillOrientationChangeEventData", "registerOrientationChangeEventCallback", "fillFullscreenChangeEventData", "registerFullscreenChangeEventCallback", "JSEvents_requestFullscreen", "JSEvents_resizeCanvasForFullscreen", "registerRestoreOldStyle", "hideEverythingExceptGivenElement", "restoreHiddenElements", "setLetterbox", "softFullscreenResizeWebGLRenderTarget", "doRequestFullscreen", "fillPointerlockChangeEventData", "registerPointerlockChangeEventCallback", "registerPointerlockErrorEventCallback", "requestPointerLock", "fillVisibilityChangeEventData", "registerVisibilityChangeEventCallback", "registerTouchEventCallback", "fillGamepadEventData", "registerGamepadEventCallback", "registerBeforeUnloadEventCallback", "fillBatteryEventData", "battery", "registerBatteryEventCallback", "setCanvasElementSize", "getCanvasElementSize", "jsStackTrace", "getCallstack", "convertPCtoSourceLocation", "getEnvStrings", "checkWasiClock", "wasiRightsToMuslOFlags", "wasiOFlagsToMuslOFlags", "initRandomFill", "randomFill", "safeSetTimeout", "setImmediateWrapped", "safeRequestAnimationFrame", "clearImmediateWrapped", "polyfillSetImmediate", "registerPostMainLoop", "registerPreMainLoop", "getPromise", "makePromise", "idsToPromises", "makePromiseCallback", "ExceptionInfo", "findMatchingCatch", "Browser_asyncPrepareDataCounter", "isLeapYear", "ydayFromDate", "arraySum", "addDays", "getSocketFromFD", "getSocketAddress", "FS_createPreloadedFile", "FS_modeStringToFlags", "FS_getMode", "FS_stdin_getChar", "FS_unlink", "FS_createDataFile", "FS_mkdirTree", "_setNetworkCallback", "heapObjectForWebGLType", "toTypedArrayIndex", "webgl_enable_ANGLE_instanced_arrays", "webgl_enable_OES_vertex_array_object", "webgl_enable_WEBGL_draw_buffers", "webgl_enable_WEBGL_multi_draw", "webgl_enable_EXT_polygon_offset_clamp", "webgl_enable_EXT_clip_control", "webgl_enable_WEBGL_polygon_mode", "emscriptenWebGLGet", "computeUnpackAlignedImageSize", "colorChannelsInGlTextureFormat", "emscriptenWebGLGetTexPixelData", "emscriptenWebGLGetUniform", "webglGetUniformLocation", "webglPrepareUniformLocationsBeforeFirstUse", "webglGetLeftBracePos", "emscriptenWebGLGetVertexAttrib", "__glGetActiveAttribOrUniform", "writeGLArray", "registerWebGlEventCallback", "runAndAbortIfError", "ALLOC_NORMAL", "ALLOC_STACK", "allocate", "writeStringToMemory", "writeAsciiToMemory", "setErrNo", "demangle", "stackTrace" ];

missingLibrarySymbols.forEach(missingLibrarySymbol);

var unexportedSymbols = [ "run", "addOnPreRun", "addOnInit", "addOnPreMain", "addOnExit", "addOnPostRun", "addRunDependency", "removeRunDependency", "out", "err", "callMain", "abort", "wasmMemory", "wasmExports", "writeStackCookie", "checkStackCookie", "stackSave", "stackRestore", "ptrToString", "exitJS", "getHeapMax", "abortOnCannotGrowMemory", "ENV", "ERRNO_CODES", "DNS", "Protocols", "Sockets", "timers", "warnOnce", "readEmAsmArgsArray", "jstoi_s", "handleException", "keepRuntimeAlive", "alignMemory", "wasmTable", "noExitRuntime", "freeTableIndexes", "functionsInTableMap", "unSign", "setValue", "getValue", "PATH", "PATH_FS", "UTF8Decoder", "UTF8ArrayToString", "UTF8ToString", "UTF16Decoder", "JSEvents", "specialHTMLTargets", "findCanvasEventTarget", "currentFullscreenStrategy", "restoreOldWindowedStyle", "UNWIND_CACHE", "ExitStatus", "flush_NO_FILESYSTEM", "promiseMap", "uncaughtExceptionCount", "exceptionLast", "exceptionCaught", "Browser", "getPreloadedImageData__data", "wget", "MONTH_DAYS_REGULAR", "MONTH_DAYS_LEAP", "MONTH_DAYS_REGULAR_CUMULATIVE", "MONTH_DAYS_LEAP_CUMULATIVE", "SYSCALLS", "preloadPlugins", "FS_stdin_getChar_buffer", "FS_createPath", "FS_createDevice", "FS_readFile", "FS", "FS_createLazyFile", "MEMFS", "TTY", "PIPEFS", "SOCKFS", "tempFixedLengthArray", "miniTempWebGLFloatBuffers", "miniTempWebGLIntBuffers", "GL", "AL", "GLUT", "EGL", "GLEW", "IDBStore", "SDL", "SDL_gfx", "allocateUTF8", "allocateUTF8OnStack", "print", "printErr" ];

unexportedSymbols.forEach(unexportedRuntimeSymbol);

var calledRun;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!calledRun) run();
  if (!calledRun) dependenciesFulfilled = runCaller;
};

// try this again later, after new deps are fulfilled
function callMain() {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on Module["onRuntimeInitialized"])');
  assert(__ATPRERUN__.length == 0, "cannot call main when preRun functions remain to be called");
  var entryFunction = _main;
  var argc = 0;
  var argv = 0;
  try {
    var ret = entryFunction(argc, argv);
    // if we're not running an evented main loop, it's time to exit
    exitJS(ret, /* implicit = */ true);
    return ret;
  } catch (e) {
    return handleException(e);
  }
}

function stackCheckInit() {
  // This is normally called automatically during __wasm_call_ctors but need to
  // get these values before even running any of the ctors so we call it redundantly
  // here.
  _emscripten_stack_init();
  // TODO(sbc): Move writeStackCookie to native to to avoid this.
  writeStackCookie();
}

function run() {
  if (runDependencies > 0) {
    return;
  }
  stackCheckInit();
  preRun();
  // a preRun added a dependency, run will be called later
  if (runDependencies > 0) {
    return;
  }
  function doRun() {
    // run may have just been called through dependencies being fulfilled just in this very frame,
    // or while the async setStatus time below was happening
    if (calledRun) return;
    calledRun = true;
    Module["calledRun"] = true;
    if (ABORT) return;
    initRuntime();
    preMain();
    Module["onRuntimeInitialized"]?.();
    if (shouldRunNow) callMain();
    postRun();
  }
  if (Module["setStatus"]) {
    Module["setStatus"]("Running...");
    setTimeout(() => {
      setTimeout(() => Module["setStatus"](""), 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in SYSCALLS_REQUIRE_FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var oldOut = out;
  var oldErr = err;
  var has = false;
  out = err = x => {
    has = true;
  };
  try {
    // it doesn't matter if it fails
    flush_NO_FILESYSTEM();
  } catch (e) {}
  out = oldOut;
  err = oldErr;
  if (has) {
    warnOnce("stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the Emscripten FAQ), or make sure to emit a newline when you printf etc.");
    warnOnce("(this may also be due to not including full filesystem support - try building with -sFORCE_FILESYSTEM)");
  }
}

if (Module["preInit"]) {
  if (typeof Module["preInit"] == "function") Module["preInit"] = [ Module["preInit"] ];
  while (Module["preInit"].length > 0) {
    Module["preInit"].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;

if (Module["noInitialRun"]) shouldRunNow = false;

run();
