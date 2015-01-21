;(function(win, lib) {
    var doc = win.document;
    var docEl = doc.documentElement;
    var metaEl = doc.querySelector('meta[name="viewport"]');
    var flexibleEl = doc.querySelector('meta[name="flexible"]');
    var dpr = 0;
    var scale = 0;
    var tid;
    var flexible = lib.flexible || (lib.flexible = {});
    
    if (metaEl) {
        console.warn('将根据已有的meta标签来设置缩放比例');
        var match = metaEl.getAttribute('content').match(/initial\-scale=([\d\.]+)/);
        if (match) {
            scale = parseFloat(match[1]);
            dpr = parseInt(1 / scale);
        }
    } else if (flexibleEl) {
        var content = flexibleEl.getAttribute('content');
        if (content) {
            var initialDpr = content.match(/initial\-dpr=([\d\.]+)/);
            var maximumDpr = content.match(/maximum\-dpr=([\d\.]+)/);
            if (initialDpr) {
                dpr = parseFloat(initialDpr[1]);
                scale = parseFloat((1 / dpr).toFixed(2));    
            }
            if (maximumDpr) {
                dpr = parseFloat(maximumDpr[1]);
                scale = parseFloat((1 / dpr).toFixed(2));    
            }
        }
    }

    if (!dpr && !scale) {
        var isAndroid = win.navigator.appVersion.match(/android/gi);
        var isIPhone = win.navigator.appVersion.match(/iphone/gi);
        var devicePixelRatio = win.devicePixelRatio;
        if (isIPhone) {
            // iOS下，对于2和3的屏，用2倍的方案，其余的用1倍方案
            if (devicePixelRatio >= 3 && (!dpr || dpr >= 3)) {                
                dpr = 3;
            } else if (devicePixelRatio >= 2 && (!dpr || dpr >= 2)){
                dpr = 2;
            } else {
                dpr = 1;
            }
        } else {
            // 其他设备下，仍旧使用1倍的方案
            dpr = 1;
        }
        scale = 1 / dpr;
    }

    docEl.setAttribute('data-dpr', dpr);
    if (!metaEl) {
        metaEl = doc.createElement('meta');
        metaEl.setAttribute('name', 'viewport');
        metaEl.setAttribute('content', 'initial-scale=' + scale + ', maximum-scale=' + scale + ', minimum-scale=' + scale + ', user-scalable=no');
        if (docEl.firstElementChild) {
            docEl.firstElementChild.appendChild(metaEl);
        } else {
            var wrap = doc.createElement('div');
            wrap.appendChild(metaEl);
            doc.write(wrap.innerHTML);
        }
    }

    function refreshRem(){
        var width = docEl.getBoundingClientRect().width;
        if (width / dpr > 540) {
            width = 540 * dpr;
        }
        var rem = width / 10;
        docEl.style.fontSize = rem + 'px';
        flexible.rem = win.rem = rem;
    }

    win.addEventListener('resize', function() {
        clearTimeout(tid);
        tid = setTimeout(refreshRem, 300);
    }, false);
    win.addEventListener('pageshow', function(e) {
        if (e.persisted) {
            clearTimeout(tid);
            tid = setTimeout(refreshRem, 300);
        }
    }, false);

    if (doc.readyState === 'complete') {
        doc.body.style.fontSize = 12 * dpr + 'px';
    } else {
        doc.addEventListener('DOMContentLoaded', function(e) {
            doc.body.style.fontSize = 12 * dpr + 'px';
        }, false);
    }
    

    refreshRem();

    flexible.dpr = win.dpr = dpr;
    flexible.refreshRem = refreshRem;
    flexible.rem2px = function(d) {
        var val = parseFloat(d) * this.rem;
        if (typeof d === 'string' && d.match(/rem$/)) {
            val += 'px';
        }
        return val;
    }
    flexible.px2rem = function(d) {
        var val = parseFloat(d) / this.rem;
        if (typeof d === 'string' && d.match(/px$/)) {
            val += 'rem';
        }
        return val;
    }

})(window, window['lib'] || (window['lib'] = {}));
// Copyright (C) 2013:
//    Alex Russell <slightlyoff@chromium.org>
//    Yehuda Katz
//
// Use of this source code is governed by
//    http://www.apache.org/licenses/LICENSE-2.0
;(function(browserGlobal, lib) {
    //
    // Async Utilities
    //

    // Borrowed from RSVP.js
    var async;

    var MutationObserver = browserGlobal.MutationObserver ||
        browserGlobal.WebKitMutationObserver;
    var Promise;

    if (MutationObserver) {
        var queue = [];

        var observer = new MutationObserver(function() {
            var toProcess = queue.slice();
            queue = [];
            toProcess.forEach(function(tuple) {
                tuple[0].call(tuple[1]);
            });
        });

        var element = document.createElement('div');
        observer.observe(element, {
            attributes: true
        });

        // Chrome Memory Leak: https://bugs.webkit.org/show_bug.cgi?id=93661
        window.addEventListener('unload', function() {
            observer.disconnect();
            observer = null;
        });

        async = function(callback, binding) {
            queue.push([callback, binding]);
            element.setAttribute('drainQueue', 'drainQueue');
        };
    } else {
        async = function(callback, binding) {
            setTimeout(function() {
                callback.call(binding);
            }, 1);
        };
    }

    //
    // Object Model Utilities
    //

    // defineProperties utilities
    var _readOnlyProperty = function(v) {
        return {
            enumerable: true,
            configurable: false,
            get: v
        };
    };

    var _method = function(v, e, c, w) {
        return {
            enumerable: !! (e || 0),
            configurable: !! (c || 1),
            writable: !! (w || 1),
            value: v || function() {}
        };
    };

    var _pseudoPrivate = function(v) {
        return _method(v, 0, 1, 0);
    };
    var _public = function(v) {
        return _method(v, 1);
    };

    //
    // Promises Utilities
    //

    var isThenable = function(any) {
        if (any === undefined)
            return false;
        try {
            var f = any.then;
            if (typeof f == "function") {
                return true;
            }
        } catch (e) { /*squelch*/ }
        return false;
    };

    var AlreadyResolved = function(name) {
        Error.call(this, name);
    };
    AlreadyResolved.prototype = Object.create(Error.prototype);

    var Backlog = function() {
        var bl = [];
        bl.pump = function(value) {
            async(function() {
                var l = bl.length;
                var x = 0;
                while (x < l) {
                    x++;
                    bl.shift()(value);
                }
            });
        };
        return bl;
    };

    //
    // Resolver Constuctor
    //

    var Resolver = function(future,
        fulfillCallbacks,
        rejectCallbacks,
        setValue,
        setError,
        setState) {
        var isResolved = false;

        var resolver = this;
        var fulfill = function(value) {
            // console.log("queueing fulfill with:", value);
            async(function() {
                setState("fulfilled");
                setValue(value);
                // console.log("fulfilling with:", value);
                fulfillCallbacks.pump(value);
            });
        };
        var reject = function(reason) {
            // console.log("queuing reject with:", reason);
            async(function() {
                setState("rejected");
                setError(reason);
                // console.log("rejecting with:", reason);
                rejectCallbacks.pump(reason);
            });
        };
        var resolve = function(value) {
            if (isThenable(value)) {
                value.then(resolve, reject);
                return;
            }
            fulfill(value);
        };
        var ifNotResolved = function(func, name) {
            return function(value) {
                if (!isResolved) {
                    isResolved = true;
                    func(value);
                } else {
                    if (typeof console != "undefined") {
                        console.error("Cannot resolve a Promise multiple times.");
                    }
                }
            };
        };

        // Indirectly resolves the Promise, chaining any passed Promise's resolution
        this.resolve = ifNotResolved(resolve, "resolve");

        // Directly fulfills the future, no matter what value's type is
        this.fulfill = ifNotResolved(fulfill, "fulfill");

        // Rejects the future
        this.reject = ifNotResolved(reject, "reject");

        this.cancel = function() {
            resolver.reject(new Error("Cancel"));
        };
        this.timeout = function() {
            resolver.reject(new Error("Timeout"));
        };

        setState("pending");
    };

    //
    // Promise Constuctor
    //

    var Promise = function(init) {
        var fulfillCallbacks = new Backlog();
        var rejectCallbacks = new Backlog();
        var value;
        var error;
        var state = "pending";

        Object.defineProperties(this, {
            _addAcceptCallback: _pseudoPrivate(
                function(cb) {
                    // console.log("adding fulfill callback:", cb);
                    fulfillCallbacks.push(cb);
                    if (state == "fulfilled") {
                        fulfillCallbacks.pump(value);
                    }
                }
            ),
            _addRejectCallback: _pseudoPrivate(
                function(cb) {
                    // console.log("adding reject callback:", cb);
                    rejectCallbacks.push(cb);
                    if (state == "rejected") {
                        rejectCallbacks.pump(error);
                    }
                }
            )
        });
        var r = new Resolver(this,
            fulfillCallbacks, rejectCallbacks,
            function(v) {
                value = v;
            },
            function(e) {
                error = e;
            },
            function(s) {
                state = s;
            })
        try {
            if (init) {
                init(r);
            }
        } catch (e) {
            r.reject(e);
            console.log(e);
        }
    };

    //
    // Consructor
    //

    var isCallback = function(any) {
        return (typeof any == "function");
    };

    // Used in .then()
    var wrap = function(callback, resolver, disposition) {
        if (!isCallback(callback)) {
            // If we don't get a callback, we want to forward whatever resolution we get
            return resolver[disposition].bind(resolver);
        }

        return function() {
            try {
                var r = callback.apply(null, arguments);
                resolver.resolve(r);
            } catch (e) {
                // Exceptions reject the resolver
                resolver.reject(e);
                console.log(e);
            }
        };
    };

    var addCallbacks = function(onfulfill, onreject, scope) {
        if (isCallback(onfulfill)) {
            scope._addAcceptCallback(onfulfill);
        }
        if (isCallback(onreject)) {
            scope._addRejectCallback(onreject);
        }
        return scope;
    };

    //
    // Prototype properties
    //

    Promise.prototype = Object.create(null, {
        "then": _public(function(onfulfill, onreject) {
            // The logic here is:
            //    We return a new Promise whose resolution merges with the return from
            //    onfulfill() or onerror(). If onfulfill() returns a Promise, we forward
            //    the resolution of that future to the resolution of the returned
            //    Promise.
            var f = this;
            return new Promise(function(r) {
                addCallbacks(wrap(onfulfill, r, "resolve"),
                    wrap(onreject, r, "reject"), f);
            });
        }),
        "catch": _public(function(onreject) {
            var f = this;
            return new Promise(function(r) {
                addCallbacks(null, wrap(onreject, r, "reject"), f);
            });
        })
    });

    //
    // Statics
    //

    Promise.isThenable = isThenable;

    var toPromiseList = function(list) {
        return Array.prototype.slice.call(list).map(Promise.resolve);
    };

    Promise.any = function( /*...futuresOrValues*/ ) {
        var futures = toPromiseList(arguments);
        return new Promise(function(r) {
            if (!futures.length) {
                r.reject("No futures passed to Promise.any()");
            } else {
                var resolved = false;
                var firstSuccess = function(value) {
                    if (resolved) {
                        return;
                    }
                    resolved = true;
                    r.resolve(value);
                };
                var firstFailure = function(reason) {
                    if (resolved) {
                        return;
                    }
                    resolved = true;
                    r.reject(reason);
                };
                futures.forEach(function(f, idx) {
                    f.then(firstSuccess, firstFailure);
                });
            }
        });
    };

    Promise.every = function( /*...futuresOrValues*/ ) {
        var futures = toPromiseList(arguments);
        return new Promise(function(r) {
            if (!futures.length) {
                r.reject("No futures passed to Promise.every()");
            } else {
                var values = new Array(futures.length);
                var count = 0;
                var accumulate = function(idx, v) {
                    count++;
                    values[idx] = v;
                    if (count == futures.length) {
                        r.resolve(values);
                    }
                };
                futures.forEach(function(f, idx) {
                    f.then(accumulate.bind(null, idx), r.reject);
                });
            }
        });
    };

    Promise.some = function() {
        var futures = toPromiseList(arguments);
        return new Promise(function(r) {
            if (!futures.length) {
                r.reject("No futures passed to Promise.some()");
            } else {
                var count = 0;
                var accumulateFailures = function(e) {
                    count++;
                    if (count == futures.length) {
                        r.reject();
                    }
                };
                futures.forEach(function(f, idx) {
                    f.then(r.resolve, accumulateFailures);
                });
            }
        });
    };

    Promise.fulfill = function(value) {
        return new Promise(function(r) {
            r.fulfill(value);
        });
    };

    Promise.resolve = function(value) {
        return new Promise(function(r) {
            r.resolve(value);
        });
    };

    Promise.reject = function(reason) {
        return new Promise(function(r) {
            r.reject(reason);
        });
    };

    Promise.deferred = function() {
        var resolver;
        var promise = new Promise(function(r) {
            resolver = r;
        });
        var deferred = {};

        ['resolve', 'reject', 'fulfill', 'timeout', 'cancel'].forEach(function(key){
            deferred[key] = function() {
                resolver[key].apply(key, arguments);
            }
        });

        deferred.promise = function(obj) {
            if (obj) {
                ['then', 'catch'].forEach(function(key) {
                    obj[key] = function() {
                        return promise[key].apply(promise, arguments);
                    }
                })
                return obj;
            } else {
                return promise;
            }
        }

        return deferred;
    }

    // 兼容Zepto和jQuery的Deferred
    if (window['$'] && !window['$'].Deferred) {
        window['$'].Deferred = function() {
            var deferred = Promise.deferred();
            deferred.resolveWith = function(context, data) {
                this.resolve.apply(context, data);
            }
            deferred.rejectWith = function(context, data) {
                this.reject.apply(context, data);
            }
            return deferred;
        }
    }

    lib.promise = Promise;

})(window, window['lib'] || (window['lib'] = {}));
;(function(win, lib, undef){

var document = win.document;
var location = win.location;
var history = win.history;
var ua = win.navigator.userAgent;
var Firefox = !!ua.match(/Firefox/i);
var IEMobile = !!ua.match(/IEMobile/i);

!history.state && history.replaceState && history.replaceState(true, null); // 先重置一次state，可以通过history.state来判断手机是否正常支持    

function Params(args) {
    args = args || '';

    var that = this;
    var params = {};
    if (args && typeof args === 'string') {
        var s1 = args.split('&');
        for (var i = 0; i < s1.length; i++) {
            var s2 = s1[i].split('=');
            params[decodeURIComponent(s2[0])] = decodeURIComponent(s2[1]);
        }
    } else if (typeof args === 'object') {
        for (var key in args) {
            params[key] = args[key];
        }
    }

    for (var key in params) {
        (function(prop){
            Object.defineProperty(that, prop, {
                get: function() {
                    return params[prop];
                },
                set: function(v) {
                    params[prop] = v;
                },
                enumerable: true
            });
        })(key);
    }

    this.toString = function() {
        return Object.keys(params).sort().map(function(key) {
            return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
        }).join('&');
    }
}

var requestAnimationFrame = window.requestAnimationFrame || 
            window.webkitRequestAnimationFrame || 
            function(cb) {
                setTimeout(cb, 1 /60);
            };

function Navigation(){
    var that = this;
    var executerQueue = [];
    var useHistoryState = !!history.state;
    var historyStorage = {
        //stack: []
    };
    var action = 'initial';

    function dispatchAnchorEvent(href) {
        var a = document.createElement('a');
        a.href = href;
        a.style.cssText = 'display:none;';
        document.body.appendChild(a);

        var e;
        if (win['MouseEvent']) {
            e = new MouseEvent('click', {
                view: window,
                bubbles: false,
                cancelable: false
            });
        } else {
            e = document.createEvent('HTMLEvents');
            e.initEvent('click', false, false);    
        }
        
        if (e) {
            a.dispatchEvent(e);    
        } else {
            location.href = href;
        }
        
    }

    function dispatchWindowEvent(name, extra) {
        var ev = document.createEvent('HTMLEvents');
        ev.initEvent(name, false, false);
        if (extra) {
            for (var key in extra) {
                ev[key] = extra[key];
            }
        }
        window.dispatchEvent(ev);
    }

    function PushExecuter(state, step){
        this.exec = function(){
            //historyStorage.stack.push(state);
            dispatchWindowEvent('navigation:push');
        }
    }

    function PopExecuter(state, step){
        this.exec = function(){
            // for (var i = 0; i > step; i--) {
            //     historyStorage.stack.pop();
            // }
            dispatchWindowEvent('navigation:pop');
        }
    }

    function ReplaceExecuter(state){
        this.exec = function(){
            // historyStorage.stack.pop();
            // historyStorage.stack.push(state);
            dispatchWindowEvent('navigation:replace');
        }
    }

    executerQueue.exec = function() {
        if (executerQueue.length) {
            executerQueue.shift().exec();
        }
    }

    function isSameState(state1, state2) {
        return state1.name === state2.name && state1.args.toString() === state2.args.toString();
    }

    this.push = function(path, args){
        var state = {
            name: path,
            args: new Params(args),
            id: historyStorage.state.id + 1
        };

        if (isSameState(state, historyStorage.state)) return;

        action = 'push';
        var search = state.args.toString();
        if (useHistoryState) {
            var hash = '#' + state.name + (search?'?' + search:'');
            history.pushState({
                name: state.name,
                args: search,
                id: state.id
            }, null, hash);
            dispatchWindowEvent('pushstate');
        } else {
            var hash = '#' + state.name + '[' + state.id + ']' + (search?'?' + search:'');
            dispatchAnchorEvent(hash);
        }
    }

    this.pop = function(){
        if (historyStorage.state.id > 1) {
            action = 'pop';
            history.back();
        }
    }

    this.replace = function(path, args) {
        var state = {
            name: path,
            args: new Params(args),
            id: historyStorage.state.id
        };

        if (isSameState(state, historyStorage.state)) return;

        action = 'replace';
        var search = state.args.toString();
        if (useHistoryState) {
            var hash = '#' + state.name + (search?'?' + search:'');
            history.replaceState({
                name: state.name,
                args: search,
                id: state.id
            }, null, hash);
            dispatchWindowEvent('replacestate');
        } else {
            var hash = '#' + state.name + '[' + state.id + ']' + (search?'?' + search:'');
            dispatchAnchorEvent(hash);
        }
    }

    var isStart = false;
    this.start = function(options) {
        if (isStart) return;
        isStart = true;

        var defaultPath = options.defaultPath || '';
        var defaultArgs = options.defaultArgs || '';
        useHistoryState &= !!options.useHistoryState;

        Object.defineProperty(this, 'useHistoryState', {
            get: function() {
                return useHistoryState;
            }
        });

        Object.defineProperty(this, 'action', {
            get: function() {
                return action;
            }
        });

        Object.defineProperty(this, 'state', {
            get: function() {
                return {
                    id: historyStorage.state.id,
                    name: historyStorage.state.name,
                    args: historyStorage.state.args
                };
            }
        });

        function getState() {
            var state;
            if (useHistoryState && history.state != null && history.state !== true) {
                state = {
                    id: history.state.id,
                    name: history.state.name,
                    args: new Params(history.state.args)
                }
            } else {
                var hash = location.hash;
                var hashMatched = hash.match(/#([^\[\]\?]+)(?:\[(\d+)\])?(?:\?(.*))?/) || ['', defaultPath, 1, defaultArgs];
                state = {
                    name: hashMatched[1],
                    id: parseInt(hashMatched[2] || 1),
                    args: new Params(hashMatched[3] || '')
                }
            }

            return state;
        }

        function stateChange(e) {
            var state = getState();
            var oldstate = historyStorage.state;
            historyStorage.state = state;

            if(state.id < oldstate.id) {
                action = 'pop';
                executerQueue.push(new PopExecuter(state, state.id - oldstate.id));
            } else if (state.id === oldstate.id) {
                if (that.action === 'replace') {
                    executerQueue.push(new ReplaceExecuter(state));
                } else {
                   // 手动改hash的问题 
                   console.error('请勿用location.hash或location.href来改变hash值');
                }
            } else {
                action = 'push';
                executerQueue.push(new PushExecuter(state, state.id - oldstate.id));
            }
            executerQueue.exec();
        }

        var state = getState();
        if (useHistoryState) {
            win.addEventListener('pushstate', stateChange, false);
            win.addEventListener('popstate', stateChange, false);
            win.addEventListener('replacestate', stateChange, false);
        } else {
            win.addEventListener('hashchange', stateChange, false);
        }

        historyStorage.state = state;

        executerQueue.push(new PushExecuter(state));
        executerQueue.exec();
    }
}

lib.navigation = Navigation;

})(window, window['lib'] || (window['lib'] = {}));
;(function(win, lib, undef) {

'use strict';

var doc = win.document,
    docEl = doc.documentElement,
    slice = Array.prototype.slice,
    gestures = {}, lastTap = null
    ;

/**
 * 找到两个结点共同的最小根结点
 * 如果跟结点不存在，则返回null
 * 
 * @param  {Element} el1 第一个结点
 * @param  {Element} el2 第二个结点
 * @return {Element}     根结点
 */
function getCommonAncestor(el1, el2) {
    var el = el1;
    while (el) {
        if (el.contains(el2) || el == el2) {
            return el;
        }
        el = el.parentNode;
    }
    return null;
}

/**
 * 触发一个事件
 * 
 * @param  {Element} element 目标结点
 * @param  {string}  type    事件类型
 * @param  {object}  extra   对事件对象的扩展
 */
function fireEvent(element, type, extra) {
    var event = doc.createEvent('HTMLEvents');
    event.initEvent(type, true, true);

    if(typeof extra === 'object') {
        for(var p in extra) {
            event[p] = extra[p];
        }
    }

    element.dispatchEvent(event);
}

/**
 * 计算变换效果
 * 假设坐标系上有4个点ABCD
 * > 旋转：从AB旋转到CD的角度
 * > 缩放：从AB长度变换到CD长度的比例
 * > 位移：从A点位移到C点的横纵位移
 * 
 * @param  {number} x1 上述第1个点的横坐标
 * @param  {number} y1 上述第1个点的纵坐标
 * @param  {number} x2 上述第2个点的横坐标
 * @param  {number} y2 上述第2个点的纵坐标
 * @param  {number} x3 上述第3个点的横坐标
 * @param  {number} y3 上述第3个点的纵坐标
 * @param  {number} x4 上述第4个点的横坐标
 * @param  {number} y4 上述第4个点的纵坐标
 * @return {object}    变换效果，形如{rotate, scale, translate[2], matrix[3][3]}
 */
function calc(x1, y1, x2, y2, x3, y3, x4, y4) {
    var rotate = Math.atan2(y4 - y3, x4 - x3) - Math.atan2(y2 - y1, x2 - x1),
        scale = Math.sqrt((Math.pow(y4 - y3, 2) + Math.pow(x4 - x3, 2)) / (Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2))),
        translate = [x3 - scale * x1 * Math.cos(rotate) + scale * y1 * Math.sin(rotate), y3 - scale * y1 * Math.cos(rotate) - scale * x1 * Math.sin(rotate)]
        ;
    return {
        rotate: rotate,
        scale: scale,
        translate: translate,
        matrix: [
            [scale * Math.cos(rotate), -scale * Math.sin(rotate), translate[0]],
            [scale * Math.sin(rotate), scale * Math.cos(rotate), translate[1]],
            [0, 0, 1]
        ]
    };
}

/**
 * 捕获touchstart事件，将每一个新增的触点添加到gestrues
 * 如果之前尚无被记录的触点，则绑定touchmove, touchend, touchcancel事件
 * 
 * 新增触点默认处于tapping状态
 * 500毫秒之后如果还处于tapping状态，则触发press手势
 * 如果触点数为2，则触发dualtouchstart手势，该手势的目标结点为两个触点共同的最小根结点
 *
 * @event
 * @param  {event} event
 */
function touchstartHandler(event) {

    if (Object.keys(gestures).length === 0) {
        docEl.addEventListener('touchmove', touchmoveHandler, false);
        docEl.addEventListener('touchend', touchendHandler, false);
        docEl.addEventListener('touchcancel', touchcancelHandler, false);
    }
    
    // 记录每一个触点
    // TODO: 变量声明方式，建议在函数最前面声明
    for(var i = 0 ; i < event.changedTouches.length ; i++ ) {
        var touch = event.changedTouches[i],
            touchRecord = {};

        for (var p in touch) {
            touchRecord[p] = touch[p];
        }

        var gesture = {
            startTouch: touchRecord,
            startTime: Date.now(),
            status: 'tapping',
            element: event.srcElement || event.target,
            // TODO: Don't make functions within a loop
            pressingHandler: setTimeout(function(element) {
                return function () {
                    if (gesture.status === 'tapping') {
                        gesture.status = 'pressing';

                        fireEvent(element, 'press', {
                            touchEvent:event
                        });
                    }

                    clearTimeout(gesture.pressingHandler);
                    gesture.pressingHandler = null;
                };
            }(event.srcElement || event.target), 500)
        };
        gestures[touch.identifier] = gesture;
    }

    // TODO: 变量声明方式，建议在函数最前面声明
    if (Object.keys(gestures).length == 2) {
        var elements = [];

        for(var p in gestures) {
            elements.push(gestures[p].element);
        }

        fireEvent(getCommonAncestor(elements[0], elements[1]), 'dualtouchstart', {
            touches: slice.call(event.touches),
            touchEvent: event
        });
    }
}

/**
 * 捕获touchmove事件，处理pan和dual的相关手势
 * 
 * 1. 遍历每个触点：
 * > 如果触点之前处于tapping状态，且位移超过10像素，则认定为进入panning状态
 * 先触发panstart手势，然后根据移动的方向选择性触发horizontalpanstart或verticalpanstart手势
 * > 如果触点之前处于panning状态，则根据pan的初始方向触发horizontalpan或verticalpan手势
 * 
 * 2. 如果当前触点数为2，则计算出几何变换的各项参数，触发dualtouch手势
 * 
 * @event
 * @param  {event} event
 */
function touchmoveHandler(event) {
    // TODO: 函数太大了，影响可读性，建议分解并加必要的注释

    // 遍历每个触点：
    // 1. 如果触点之前处于tapping状态，且位移超过10像素，则认定为进入panning状态
    // 先触发panstart手势，然后根据移动的方向选择性触发horizontalpanstart或verticalpanstart手势
    // 2. 如果触点之前处于panning状态，则根据pan的初始方向触发horizontalpan或verticalpan手势
    for(var i = 0 ; i < event.changedTouches.length ; i++ ) {
        var touch = event.changedTouches[i],
            gesture = gestures[touch.identifier];

        if (!gesture) {
            return;
        }
        
        if(!gesture.lastTouch) {
            gesture.lastTouch = gesture.startTouch;
        }
        if(!gesture.lastTime) {
            gesture.lastTime = gesture.startTime;
        }
        if(!gesture.velocityX) {
            gesture.velocityX = 0;
        }
        if(!gesture.velocityY) {
            gesture.velocityY = 0;
        }
        if(!gesture.duration) {
            gesture.duration = 0;
        }
        
        var time =  Date.now()-gesture.lastTime;
        var vx = (touch.clientX - gesture.lastTouch.clientX)/time,
            vy = (touch.clientY - gesture.lastTouch.clientY)/time;
        
        var RECORD_DURATION = 70;
        if( time > RECORD_DURATION ) {
            time = RECORD_DURATION;
        }
        if( gesture.duration + time > RECORD_DURATION ) {
            gesture.duration = RECORD_DURATION - time;
        }

        gesture.velocityX = (gesture.velocityX * gesture.duration + vx * time) / (gesture.duration+ time);
        gesture.velocityY = (gesture.velocityY * gesture.duration + vy * time) / (gesture.duration+ time);
        gesture.duration += time;

        gesture.lastTouch = {};
        
        for (var p in touch) {
            gesture.lastTouch[p] = touch[p];
        }
        gesture.lastTime = Date.now();

        var displacementX = touch.clientX - gesture.startTouch.clientX,
            displacementY = touch.clientY - gesture.startTouch.clientY,
            distance = Math.sqrt(Math.pow(displacementX, 2) + Math.pow(displacementY, 2));
        
        // magic number 10: moving 10px means pan, not tap
        if ((gesture.status === 'tapping' || gesture.status === 'pressing') && distance > 10) {
            gesture.status = 'panning';
            gesture.isVertical = !(Math.abs(displacementX) > Math.abs(displacementY));

            fireEvent(gesture.element, 'panstart', {
                touch:touch,
                touchEvent:event,
                isVertical: gesture.isVertical
            });

            fireEvent(gesture.element, (gesture.isVertical?'vertical':'horizontal') + 'panstart', {
                touch: touch,
                touchEvent: event
            });
        }

        if (gesture.status === 'panning') {
            gesture.panTime = Date.now();
            fireEvent(gesture.element, 'pan', {
                displacementX: displacementX,
                displacementY: displacementY,
                touch: touch,
                touchEvent: event,
                isVertical: gesture.isVertical
            });


            if(gesture.isVertical) {
                fireEvent(gesture.element, 'verticalpan',{
                    displacementY: displacementY,
                    touch: touch,
                    touchEvent: event
                });
            } else {
                fireEvent(gesture.element, 'horizontalpan',{
                    displacementX: displacementX,
                    touch: touch,
                    touchEvent: event
                });
            }
        }
    }

    // 如果当前触点数为2，则计算出几何变换的各项参数，触发dualtouch手势
    if (Object.keys(gestures).length == 2) {
        var position = [],
            current = [],
            elements = [],
            transform
            ;
        
        // TODO: 变量声明方式，建议在函数最前面声明
        for(var i = 0 ; i < event.touches.length ; i++ ) {
            var touch = event.touches[i];
            var gesture = gestures[touch.identifier];
            position.push([gesture.startTouch.clientX, gesture.startTouch.clientY]);
            current.push([touch.clientX, touch.clientY]);
        }

        // TODO: 变量声明方式，建议在函数最前面声明
        for(var p in gestures) {
            elements.push(gestures[p].element);
        }

        transform = calc(position[0][0], position[0][1], position[1][0], position[1][1], current[0][0], current[0][1], current[1][0], current[1][1]);
        fireEvent(getCommonAncestor(elements[0], elements[1]), 'dualtouch',{
            transform : transform,
            touches : event.touches,
            touchEvent: event
        });
    }
}

/**
 * 捕获touchend事件
 * 
 * 1. 如果当前触点数为2，则触发dualtouchend手势
 *
 * 2. 遍历每个触点：
 * > 如果处于tapping状态，则触发tap手势
 * 如果之前300毫秒出现过tap手势，则升级为doubletap手势
 * > 如果处于panning状态，则根据滑出的速度，触发panend/flick手势
 * flick手势被触发之后，再根据滑出的方向触发verticalflick/horizontalflick手势
 * > 如果处于pressing状态，则触发pressend手势
 *
 * 3. 解绑定所有相关事件
 * 
 * @event
 * @param  {event} event
 */
function touchendHandler(event) {

    if (Object.keys(gestures).length == 2) {
        var elements = [];
        for(var p in gestures) {
            elements.push(gestures[p].element);
        }
        fireEvent(getCommonAncestor(elements[0], elements[1]), 'dualtouchend', {
            touches: slice.call(event.touches),
            touchEvent: event
        });
    }
    
    for (var i = 0; i < event.changedTouches.length; i++) {
        var touch = event.changedTouches[i],
            id = touch.identifier,
            gesture = gestures[id];

        if (!gesture) continue;

        if (gesture.pressingHandler) {
            clearTimeout(gesture.pressingHandler);
            gesture.pressingHandler = null;
        }

        if (gesture.status === 'tapping') {
            gesture.timestamp = Date.now();
            fireEvent(gesture.element, 'tap', {
                touch: touch,
                touchEvent: event
            });

            if(lastTap && gesture.timestamp - lastTap.timestamp < 300) {
                fireEvent(gesture.element, 'doubletap', {
                    touch: touch,
                    touchEvent: event
                });
            }

            lastTap = gesture;
        }

        if (gesture.status === 'panning') {
            var now = Date.now();
            var duration = now - gesture.startTime,
                // TODO: velocityX & velocityY never used
                velocityX = (touch.clientX - gesture.startTouch.clientX) / duration,
                velocityY = (touch.clientY - gesture.startTouch.clientY) / duration,
                displacementX = touch.clientX - gesture.startTouch.clientX,
                displacementY = touch.clientY - gesture.startTouch.clientY
                ;

            var velocity = Math.sqrt(gesture.velocityY*gesture.velocityY+gesture.velocityX*gesture.velocityX);
            var isflick = velocity > 0.5 && (now - gesture.lastTime) < 100;
            var extra = {
                duration: duration,
                isflick: isflick,
                velocityX: gesture.velocityX,
                velocityY: gesture.velocityY,
                displacementX: displacementX,
                displacementY: displacementY,
                touch: touch,
                touchEvent: event,
                isVertical: gesture.isVertical
            }

            fireEvent(gesture.element, 'panend', extra);
            if (isflick) {
                fireEvent(gesture.element, 'flick', extra);

                if(gesture.isVertical) {
                    fireEvent(gesture.element, 'verticalflick', extra);
                } else {
                    fireEvent(gesture.element, 'horizontalflick', extra);
                }
            }
        }

        if (gesture.status === 'pressing') {
            fireEvent(gesture.element, 'pressend', {
                touch: touch,
                touchEvent: event
            });
        }

        delete gestures[id];
    }

    if (Object.keys(gestures).length === 0) {
        docEl.removeEventListener('touchmove', touchmoveHandler, false);
        docEl.removeEventListener('touchend', touchendHandler, false);
        docEl.removeEventListener('touchcancel', touchcancelHandler, false);
    }
}

/**
 * 捕获touchcancel事件
 * 
 * 1. 如果当前触点数为2，则触发dualtouchend手势
 *
 * 2. 遍历每个触点：
 * > 如果处于panning状态，则触发panend手势
 * > 如果处于pressing状态，则触发pressend手势
 *
 * 3. 解绑定所有相关事件
 * 
 * @event
 * @param  {event} event
 */
function touchcancelHandler(event) {
    // TODO: 和touchendHandler大量重复，建议DRY

    if (Object.keys(gestures).length == 2) {
        var elements = [];
        for(var p in gestures) {
            elements.push(gestures[p].element);
        }
        fireEvent(getCommonAncestor(elements[0], elements[1]), 'dualtouchend', {
            touches: slice.call(event.touches),
            touchEvent: event
        });
    }

    for (var i = 0; i < event.changedTouches.length; i++) {
        var touch = event.changedTouches[i],
            id = touch.identifier,
            gesture = gestures[id];

        if (!gesture) continue;

        if (gesture.pressingHandler) {
            clearTimeout(gesture.pressingHandler);
            gesture.pressingHandler = null;
        }

        if (gesture.status === 'panning') {
            fireEvent(gesture.element, 'panend', {
                touch: touch,
                touchEvent: event
            });
        }
        if (gesture.status === 'pressing') {
            fireEvent(gesture.element, 'pressend', {
                touch: touch,
                touchEvent: event
            });
        }
        delete gestures[id];
    }

    if (Object.keys(gestures).length === 0) {
        docEl.removeEventListener('touchmove', touchmoveHandler, false);
        docEl.removeEventListener('touchend', touchendHandler, false);
        docEl.removeEventListener('touchcancel', touchcancelHandler, false);
    }
}

docEl.addEventListener('touchstart', touchstartHandler, false);

})(window, window.lib || (window.lib = {}));
;(function(win, lib) {

    function Motion(config){

        this.v = config.v || 0;
        this.a = config.a || 0;
        
        if(typeof config.t !== 'undefined') {
            this.t = config.t;
        }

        if(typeof config.s !== 'undefined') {
            this.s = config.s;
        }

        if (typeof this.t === 'undefined') {
            if (typeof this.s === 'undefined') {
                this.t = - this.v / this.a;
            } else {
                var t1 = (Math.sqrt(this.v * this.v + 2 * this.a * this.s) - this.v) / this.a;
                var t2 = (-Math.sqrt(this.v * this.v + 2 * this.a * this.s) - this.v) / this.a;
                this.t = Math.min(t1, t2);
            }
        }

        if (typeof this.s === 'undefined') {
            this.s = this.a * this.t * this.t / 2 + this.v * this.t;
        }
        
        this.generateCubicBezier = function() {
            function quadratic2cubicBezier(a, b) {
                return [[(a / 3 + (a + b) / 3 - a) / (b - a), (a * a / 3 + a * b * 2 / 3 - a * a) / (b * b - a * a)],
                    [(b / 3 + (a + b) / 3 - a) / (b - a), (b * b / 3 + a * b * 2 / 3 - a * a) / (b * b - a * a)]];
            }
            return quadratic2cubicBezier( this.v / this.a , this.t + this.v / this.a );
        }
        
    };

    lib.motion = Motion;

})(window, window['lib'] || (window['lib'] = {}));

;(function(win, lib) {

var FPS = 60;
var INTERVAL = 1000 / FPS;

function setTimeoutFrame(cb) {
    return setTimeout(cb, INTERVAL);
}

function clearTimeoutFrame(tick) {
    clearTimeout(tick);
}

var requestAnimationFrame = 
            window.requestAnimationFrame || 
                window.msRequestAnimationFrame ||
                window.webkitRequestAnimationFrame || 
                window.mozRequestAnimationFrame || 
                setTimeoutFrame;


var cancelAnimationFrame = 
            window.cancelAnimationFrame ||
                window.msCancelAnimationFrame ||
                window.webkitCancelAnimationFrame ||
                window.mozCancelAnimationFrame ||
                clearTimeoutFrame;

if (requestAnimationFrame === setTimeoutFrame || cancelAnimationFrame === clearTimeoutFrame) {
    requestAnimationFrame = setTimeoutFrame;
    cancelAnimationFrame = clearTimeoutFrame;
}

function Frame(fun) {
    var isRequested = false;
    Object.defineProperty(this, 'isRequested', {
        get: function() {
            return isRequested;
        }
    });

    var callback = [];
    function done() {
        isRequested = true;
        if (callback) {
            callback.forEach(function(cb) {
                cb && cb();
            });
        }
    }

    var tick;
    var isCancel =false;
    this.request = function() {
        if (isRequested) return;

        var args = arguments;
        isCancel = false;
        tick = requestAnimationFrame(function() {
            if (isCancel) return;
            fun.apply(win, args);
            done();
        });

        return this;
    }

    this.cancel = function() {
        if (tick) {
            isCancel = true;
            cancelAnimationFrame(tick);
        }
    }

    this.then = function(cb) {
        if (isRequested) {
            cb && cb();
        } else {
            callback.push(cb);    
        }
        return this;
    }

    this.clone = function() {
        return new Frame(fun);
    }
}

function Animation(duration, timingFunction, delay, frames) {

    if (typeof frames === 'function') {
        frames = {
            '0': frames
        };
    }

    var frameCount = duration / INTERVAL;
    var framePercent = 1 / frameCount;
    var frameQueue = [];
    var frameKeys = Object.keys(frames).map(function(i) {return parseInt(i)});

    for (var i = 0; i < frameCount; i++) {
        var key = frameKeys[0];
        var percent = framePercent * i;
        if (key != null && key <= percent * 100) {
            var frame = frames['' + key];
            if (!(frame instanceof Frame)) {
                frame = new Frame(frame);
            }
            frameQueue.push(frame);
            frameKeys.shift();
        } else if (frameQueue.length) {
            frameQueue.push(frameQueue[frameQueue.length - 1].clone());
        }
    }

    var bezier;
    if (typeof timingFunction === 'string' || timingFunction instanceof Array) {
        if (!lib['cubicbezier']) {
            console.error('require lib.cubicbezier');
        } else {
            if (typeof timingFunction === 'string') {
                if (lib.cubicbezier[timingFunction]) {
                    bezier = lib.cubicbezier[timingFunction];
                }
            } else if (timingFunction instanceof Array && timingFunction.length === 4){
                bezier = lib.cubicbezier.apply(lib.cubicbezier, timingFunction);
            }
        }
    } else if (typeof timingFunction === 'function') {
        bezier = timingFunction;
    }

    if (!bezier) {
        console.error('unexcept timing function');
    }

    var isPlaying = false;
    var delayTick = 0;
    var frameIndex = 0;
    var currentFrame;
    
    this.play = function() {
        if (isPlaying) return;
        isPlaying = true;

        function done() {
            isPlaying = false;
            endHandler && endHandler();
        }

        function request() {
            var percent = framePercent * (frameIndex + 1).toFixed(10);

            currentFrame = frameQueue[frameIndex];
            currentFrame.request(percent.toFixed(10), timingFunction(percent).toFixed(10));
            currentFrame.then(function() {
                frameIndex++;
                next();
            });
        }

        function next() {
            if (!isPlaying) return;

            if (frameIndex === frameQueue.length) {
                done();
            } else {
                request();
            }
        }

        delayTick = setTimeout(function() {
            delayTick = 0;
            next();
        }, !frameIndex && delay || 0);
        return this;
    }

    this.stop = function() {
        if (!isPlaying) return;
        isPlaying = false;

        if (delayTick) {
            clearTimeout(delayTick);
            delayTick = 0;
        }

        if (currentFrame) {
            currentFrame.cancel();
        }

        return this;
    }

    var endHandler;
    this.onend = function(handler) {
        endHandler = handler;
    }
}

lib.animation = Animation;

lib.animation.Frame = Frame;

lib.animation.requestFrame = function(fun) {
    var frame = new Frame(fun);
    frame.request();
    return frame;
}

})(window, window['lib'] || (window['lib'] = {}))
;(function(win, lib) {

    function cubicBezierFunction(p1x, p1y, p2x, p2y) {
        var ZERO_LIMIT = 1e-6;
        // Calculate the polynomial coefficients,
        // implicit first and last control points are (0,0) and (1,1).
        var ax = 3 * p1x - 3 * p2x + 1,
            bx = 3 * p2x - 6 * p1x,
            cx = 3 * p1x;

        var ay = 3 * p1y - 3 * p2y + 1,
            by = 3 * p2y - 6 * p1y,
            cy = 3 * p1y;

        function sampleCurveDerivativeX(t) {
            // `ax t^3 + bx t^2 + cx t' expanded using Horner 's rule.
            return (3 * ax * t + 2 * bx) * t + cx;
        }

        function sampleCurveX(t) {
            return ((ax * t + bx) * t + cx ) * t;
        }

        function sampleCurveY(t) {
            return ((ay * t + by) * t + cy ) * t;
        }

        // Given an x value, find a parametric value it came from.
        function solveCurveX(x) {
            var t2 = x,
                derivative,
                x2;

            // https://trac.webkit.org/browser/trunk/Source/WebCore/platform/animation
            // First try a few iterations of Newton's method -- normally very fast.
            // http://en.wikipedia.org/wiki/Newton's_method
            for (var i = 0; i < 8; i++) {
                // f(t)-x=0
                x2 = sampleCurveX(t2) - x;
                if (Math.abs(x2) < ZERO_LIMIT) {
                    return t2;
                }
                derivative = sampleCurveDerivativeX(t2);
                // == 0, failure
                if (Math.abs(derivative) < ZERO_LIMIT) {
                    break;
                }
                t2 -= x2 / derivative;
            }

            // Fall back to the bisection method for reliability.
            // bisection
            // http://en.wikipedia.org/wiki/Bisection_method
            var t1 = 1,
                t0 = 0;
            t2 = x;
            while (t1 > t0) {
                x2 = sampleCurveX(t2) - x;
                if (Math.abs(x2) < ZERO_LIMIT) {
                    return t2;
                }
                if (x2 > 0) {
                    t1 = t2;
                } else {
                    t0 = t2;
                }
                t2 = (t1 + t0) / 2;
            }

            // Failure
            return t2;
        }

        function solve(x) {
            return sampleCurveY(solveCurveX(x));
        }

        return solve;
    }

    lib.cubicbezier = cubicBezierFunction;
    lib.cubicbezier.linear = cubicBezierFunction(0,0,1,1);
    lib.cubicbezier.ease = cubicBezierFunction(.25,.1,.25,1);
    lib.cubicbezier.easeIn = cubicBezierFunction(.42,0,1,1);
    lib.cubicbezier.easeOut = cubicBezierFunction(0,0,.58,1);
    lib.cubicbezier.easeInOut = cubicBezierFunction(.42,0,.58,1);

})(window, window['lib'] || (window['lib'] = {}));
;(function(win, lib, undef) {
var doc = win.document;
var ua = win.navigator.userAgent;
var scrollObjs = {};
var plugins = {};
var dpr = win.dpr || (!!win.navigator.userAgent.match(/iPhone|iPad|iPod/)?document.documentElement.clientWidth/win.screen.availWidth:1);
var inertiaCoefficient = {
    'normal': [2 * dpr, 0.0015 * dpr],
    'slow': [1.5 * dpr, 0.003 * dpr],
    'veryslow': [1.5 * dpr, 0.005 * dpr]
}
var timeFunction = {
    'ease': [.25,.1,.25,1],
    'liner': [0,0,1,1],
    'ease-in': [.42,0,1,1],
    'ease-out': [0,0,.58,1],
    'ease-in-out': [.42,0,.58,1]
}
var Firefox = !!ua.match(/Firefox/i);
var IEMobile = !!ua.match(/IEMobile/i);
var cssPrefix = Firefox?'-moz-':IEMobile?'-ms-':'-webkit-';
var stylePrefix = Firefox?'Moz':IEMobile?'ms':'webkit';

function debugLog() {
    if (lib.scroll.outputDebugLog) {
        console.debug.apply(console, arguments);
    }
}

function getBoundingClientRect(el) {
    var rect = el.getBoundingClientRect();
    if (!rect) {
        rect = {};
        rect.width = el.offsetWidth;
        rect.height = el.offsetHeight;

        rect.left = el.offsetLeft;
        rect.top = el.offsetTop;
        var parent = el.offsetParent;
        while (parent) {
            rect.left += parent.offsetLeft;
            rect.top += parent.offsetTop;
            parent = parent.offsetParent;
        }

        rect.right = rect.left + rect.width;
        rect.bottom = rect.top + rect.height;
    }
    return rect;
}

function getMinScrollOffset(scrollObj) {
    return 0 - scrollObj.options[scrollObj.axis + 'PaddingTop'];
}

function getMaxScrollOffset(scrollObj) {
    var rect = getBoundingClientRect(scrollObj.element);
    var pRect = getBoundingClientRect(scrollObj.viewport);
    var min = getMinScrollOffset(scrollObj);
    if (scrollObj.axis === 'y') {
        var max = 0 - rect.height + pRect.height;
    } else {
        var max = 0 - rect.width + pRect.width;
    }
    return Math.min(max + scrollObj.options[scrollObj.axis + 'PaddingBottom'], min);
}

function getBoundaryOffset(scrollObj, offset) {
    if(offset > scrollObj.minScrollOffset) {
        return offset - scrollObj.minScrollOffset;
    } else if (offset < scrollObj.maxScrollOffset){
        return offset - scrollObj.maxScrollOffset;
    }
}

function touchBoundary(scrollObj, offset) {
    if (offset > scrollObj.minScrollOffset) {
        offset = scrollObj.minScrollOffset;
    } else if (offset < scrollObj.maxScrollOffset) {
        offset = scrollObj.maxScrollOffset;
    }
    return offset;
}

function fireEvent(scrollObj, eventName, extra) {
    debugLog(scrollObj.element.scrollId, eventName, extra);

    var event = doc.createEvent('HTMLEvents');
    event.initEvent(eventName, false, true);
    event.scrollObj = scrollObj;
    if (extra) {
        for (var key in extra) {
            event[key] = extra[key];
        }
    }
    scrollObj.element.dispatchEvent(event);
    scrollObj.viewport.dispatchEvent(event);
}

function getTransformOffset(scrollObj) {
    var offset = {x: 0, y: 0}; 
    var transform = getComputedStyle(scrollObj.element)[stylePrefix + 'Transform'];
    var matched;

    if (transform !== 'none') {
        if ((matched = transform.match(/^matrix3d\((?:[-\d.]+,\s*){12}([-\d.]+),\s*([-\d.]+)(?:,\s*[-\d.]+){2}\)/) ||
                transform.match(/^matrix\((?:[-\d.]+,\s*){4}([-\d.]+),\s*([-\d.]+)\)$/))) {
            offset.x = parseFloat(matched[1]) || 0;
            offset.y = parseFloat(matched[2]) || 0;
        }
    }

    return offset;
}

var CSSMatrix = IEMobile?'MSCSSMatrix':'WebKitCSSMatrix';
var has3d = !!Firefox || CSSMatrix in win && 'm11' in new win[CSSMatrix]();
function getTranslate(x, y) {
    x = parseFloat(x);
    y = parseFloat(y);

    if (x != 0) {
        x += 'px';
    }

    if (y != 0) {
        y += 'px';
    }

    if (has3d) {
        return 'translate3d(' + x + ', ' + y + ', 0)';
    } else {
        return 'translate(' + x + ', ' + y + ')';
    }
}

function setTransitionStyle(scrollObj, duration, timingFunction) {
    if (duration === '' && timingFunction === '') {
        scrollObj.element.style[stylePrefix + 'Transition'] = '';    
    } else {
        scrollObj.element.style[stylePrefix + 'Transition'] = cssPrefix + 'transform ' + duration + ' ' + timingFunction + ' 0s';
    }
}

function setTransformStyle(scrollObj, offset) {
    var x = 0, y = 0;
    if (typeof offset === 'object') {
        x = offset.x;
        y = offset.y;
    } else {
        if (scrollObj.axis === 'y') {
            y = offset;
        } else {
            x = offset;
        }
    }
    scrollObj.element.style[stylePrefix + 'Transform'] = getTranslate(x, y);
}

var panning = false;
doc.addEventListener('touchmove', function(e){
    if (panning) {
        e.preventDefault();
        return false;
    }
    return true;
}, false);

function Scroll(element, options){
    var that = this;

    options = options || {};
    options.noBounce = !!options.noBounce;
    options.padding = options.padding || {};

    if (options.isPrevent == null) {
        options.isPrevent = true;
    } else {
        options.isPrevent = !!options.isPrevent;
    }

    if (options.isFixScrollendClick == null) {
        options.isFixScrollendClick = true;
    } else {
        options.isFixScrollendClick = !!options.isFixScrollendClick;
    }

    if (options.padding) {
        options.yPaddingTop = -options.padding.top || 0;
        options.yPaddingBottom = -options.padding.bottom || 0;
        options.xPaddingTop = -options.padding.left || 0;
        options.xPaddingBottom = -options.padding.right || 0;
    } else {
        options.yPaddingTop = 0;
        options.yPaddingBottom = 0;
        options.xPaddingTop = 0;
        options.xPaddingBottom = 0;
    }

    options.direction = options.direction || 'y';
    options.inertia = options.inertia || 'normal';

    this.options = options;
    that.axis = options.direction;
    this.element = element;
    this.viewport = element.parentNode;
    this.plugins = {};

    this.element.scrollId = setTimeout(function(){
        scrollObjs[that.element.scrollId + ''] = that;
    }, 1);

    this.viewport.addEventListener('touchstart', touchstartHandler, false);
    this.viewport.addEventListener('touchend', touchendHandler, false);
    this.viewport.addEventListener('touchcancel', touchendHandler, false);
    this.viewport.addEventListener('panstart', panstartHandler, false);
    this.viewport.addEventListener('pan', panHandler, false);
    this.viewport.addEventListener('panend', panendHandler, false);

    if (options.isPrevent) {
        this.viewport.addEventListener('touchstart', function(e) {
            panning = true;
        }, false);
        that.viewport.addEventListener('touchend', function(e){  
            panning = false;
        }, false);
    }

    // if (options.isPrevent) { 
    //     var d = this.axis === 'y'?'vertical':'horizontal'; 
    //     this.viewport.addEventListener(d + 'panstart', function(e) { 
    //         panning = true; 
    //     }, false); 
    //     that.viewport.addEventListener('panend', function(e){
    //         panning = false; 
    //     }, false); 
    // }

    if (options.isFixScrollendClick) {
        var preventScrollendClick;
        var fixScrollendClickTimeoutId;

        this.viewport.addEventListener('scrolling', function() {
            preventScrollendClick = true;
            fixScrollendClickTimeoutId && clearTimeout(fixScrollendClickTimeoutId);
            fixScrollendClickTimeoutId = setTimeout(function(e){
                preventScrollendClick = false;
            }, 400);
        }, false);

        function preventScrollendClickHandler(e) {
            if (preventScrollendClick || isScrolling) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            } else {
                return true;
            }
        }

        function fireNiceTapEventHandler(e) {
            if (!preventScrollendClick && !isScrolling) {
                setTimeout(function(){
                    var niceTapEvent = document.createEvent('HTMLEvents');
                    niceTapEvent.initEvent('niceclick', true, true);
                    e.target.dispatchEvent(niceTapEvent);
                }, 300);
            }
        }

        this.viewport.addEventListener('click', preventScrollendClickHandler, false);
        this.viewport.addEventListener('tap', fireNiceTapEventHandler, false);
    }

    if (options.useFrameAnimation) {
        var scrollAnimation;

        Object.defineProperty(this, 'animation', {
            get: function() {
                return scrollAnimation;
            }
        });
    } else {
        var transitionEndHandler;
        var transitionEndTimeoutId = 0;

        function setTransitionEndHandler(h, t) {
            transitionEndHandler = null;
            clearTimeout(transitionEndTimeoutId);
            
            transitionEndTimeoutId = setTimeout(function() {
                if (transitionEndHandler) {
                    transitionEndHandler = null;
                    lib.animation.requestFrame(h);
                }
            }, (t || 400));

            transitionEndHandler = h;   
        }

        element.addEventListener(Firefox?'transitionend':(stylePrefix + 'TransitionEnd'), function(e) {
            if (transitionEndHandler) {
                var handler = transitionEndHandler;

                transitionEndHandler = null;
                clearTimeout(transitionEndTimeoutId);

                lib.animation.requestFrame(function(){
                    handler(e);
                });
            }
        }, false);
    }

    var panFixRatio;
    var isScrolling;
    var isFlickScrolling;
    var cancelScrollEnd;

    Object.defineProperty(this, 'isScrolling', {
        get: function() {
            return !!isScrolling;
        }
    });

    function isEnabled(e) {
        if (!that.enabled) {
            return false;
        }

        if (typeof e.isVertical != 'undefined') {
            if (that.axis === 'y' && e.isVertical || that.axis === 'x' && !e.isVertical) {
                // 同方向的手势，停止冒泡
                e.stopPropagation();
            } else {
                // 不是同方向的手势，冒泡到上层，不做任何处理
                return false;
            }
        }

        return true;
    }

    function touchstartHandler(e) {
        if (!isEnabled(e)) {
            return;
        }

        if (isScrolling) {
            scrollEnd();
        }

        if (options.useFrameAnimation) {
            scrollAnimation && scrollAnimation.stop();
            scrollAnimation = null;
        } else {
            var transform = getTransformOffset(that);
            setTransformStyle(that, transform);
            setTransitionStyle(that, '', '');
            transitionEndHandler = null;
            clearTimeout(transitionEndTimeoutId);
        }

    }

    function touchendHandler(e) {
        if (!isEnabled(e)) {
            return;
        }

        var s0 = getTransformOffset(that)[that.axis];
        var boundaryOffset = getBoundaryOffset(that, s0);

        if (boundaryOffset) {   
            // 拖动超出边缘，需要回弹
            var s1 = touchBoundary(that, s0);

            if (options.useFrameAnimation) {
                // frame
                var _s = s1 - s0;
                scrollAnimation = new lib.animation(400, lib.cubicbezier.ease, 0, function(i1, i2) {
                    var offset = (s0 + _s * i2).toFixed(2);
                    setTransformStyle(that, offset);
                    fireEvent(that, 'scrolling');
                });
                scrollAnimation.onend(scrollEnd);
                scrollAnimation.play();
            } else {
                // css
                var offset =  s1.toFixed(0);
                setTransitionStyle(that, '0.4s', 'ease');
                setTransformStyle(that, offset);
                setTransitionEndHandler(scrollEnd, 400);

                lib.animation.requestFrame(function() {
                    if (isScrolling && that.enabled) {
                        fireEvent(that, 'scrolling');
                        lib.animation.requestFrame(arguments.callee);
                    }
                });                
            }

            if (boundaryOffset > 0) {
                fireEvent(that, that.axis === 'y'?'pulldownend':'pullrightend');
            } else if (boundaryOffset < 0) {
                fireEvent(that, that.axis === 'y'?'pullupend':'pullleftend');
            }
        } else if (isScrolling) {
            // 未超出边缘，直接结束
            scrollEnd();
        }
    }

    var lastDisplacement;
    function panstartHandler(e) {
        if (!isEnabled(e)) {
            return;
        }
        
        that.transformOffset = getTransformOffset(that);
        that.minScrollOffset = getMinScrollOffset(that);
        that.maxScrollOffset = getMaxScrollOffset(that);
        panFixRatio = 2.5;
        cancelScrollEnd = true;
        isScrolling = true;
        isFlickScrolling = false;
        fireEvent(that, 'scrollstart');

        lastDisplacement = e['displacement' + that.axis.toUpperCase()];
    }


    function panHandler(e) {
        if (!isEnabled(e)) {
            return;
        }

        // 手指移动小于5像素，也忽略
        var displacement = e['displacement' + that.axis.toUpperCase()];
        if (Math.abs(displacement - lastDisplacement) < 5) {
            e.stopPropagation();
            return;
        }
        lastDisplacement = displacement;

        var offset = that.transformOffset[that.axis] + displacement;
        if(offset > that.minScrollOffset) {
            offset = that.minScrollOffset + (offset - that.minScrollOffset) / panFixRatio;
            panFixRatio *= 1.003;
        } else if(offset < that.maxScrollOffset) {
            offset = that.maxScrollOffset - (that.maxScrollOffset - offset) / panFixRatio;
            panFixRatio *= 1.003;
        }
        if (panFixRatio > 4) {
            panFixRatio = 4;
        }

        // 判断是否到了边缘
        var boundaryOffset = getBoundaryOffset(that, offset);
        if (boundaryOffset) {
            fireEvent(that, boundaryOffset > 0?(that.axis === 'y'?'pulldown':'pullright'):(that.axis === 'y'?'pullup':'pullleft'), {
                boundaryOffset: Math.abs(boundaryOffset)
            });
            if (that.options.noBounce) {
                offset = touchBoundary(that, offset);
            }
        }

        setTransformStyle(that, offset.toFixed(2));
        fireEvent(that, 'scrolling');
    }

    function panendHandler(e) {
        if (!isEnabled(e)) {
            return;
        }

        if (e.isflick) {
            flickHandler(e);
        }
    }

    function flickHandler(e) {
        cancelScrollEnd = true;
    
        var v0, a0, t0, s0, s, motion0;
        var v1, a1, t1, s1, motion1,sign;
        var v2, a2, t2, s2, motion2, ft;
        
        s0 = getTransformOffset(that)[that.axis];
        var boundaryOffset0 = getBoundaryOffset(that, s0);
        if(!boundaryOffset0) {
            //手指离开屏幕时，已经超出滚动范围，不作处理，让touchend handler处理
            //手指离开屏幕时，在滚动范围内，做一下惯性计算
            v0 = e['velocity' + that.axis.toUpperCase()];

            var maxV = 2;
            var friction = 0.0015;
            if (options.inertia && inertiaCoefficient[options.inertia]) {
                maxV = inertiaCoefficient[options.inertia][0];
                friction = inertiaCoefficient[options.inertia][1];
            }

            if (v0 > maxV) {
                v0 = maxV;
            }
            if (v0 < -maxV) {
                v0 = -maxV;
            }
            a0 = friction * ( v0 / Math.abs(v0));
            motion0 = new lib.motion({
                v: v0,
                a: -a0
            });
            t0 = motion0.t;
            s = s0 + motion0.s;

            var boundaryOffset1 = getBoundaryOffset(that, s);
            if (boundaryOffset1) {
                //惯性运动足够滑出屏幕边缘
                debugLog('惯性计算超出了边缘', boundaryOffset1);

                v1 = v0;
                a1 = a0;
                if(boundaryOffset1 > 0) {
                    s1 = that.minScrollOffset;
                    sign = 1;
                } else {
                    s1 = that.maxScrollOffset;
                    sign = -1;
                }
                motion1 = new lib.motion({
                    v: sign * v1, 
                    a: - sign * a1, 
                    s: Math.abs(s1 - s0)
                });
                t1 = motion1.t;
                var timeFunction1 = motion1.generateCubicBezier();

                v2 = v1 - a1 * t1;
                a2 = 0.03 * (v2 / Math.abs(v2));
                motion2 = new lib.motion({
                    v: v2,
                    a: -a2
                });
                t2 = motion2.t;
                s2 = s1 + motion2.s;
                var timeFunction2 = motion2.generateCubicBezier();

                if (options.noBounce) {
                    // 没有边缘回弹效果，直接平顺滑到边缘
                    debugLog('没有回弹效果');

                    if (s0 !== s1) {
                        if (options.useFrameAnimation) {
                            // frame
                            var _s = s1 - s0;
                            var bezier = lib.cubicbezier(timeFunction1[0][0], timeFunction1[0][1], timeFunction1[1][0], timeFunction1[1][1]);
                            scrollAnimation = new lib.animation(t1.toFixed(0), bezier, 0, function(i1, i2) {
                                var offset = (s0 + _s * i2);
                                getTransformOffset(that, offset.toFixed(2));
                                fireEvent(that, 'scrolling',{
                                    afterFlick: true
                                });
                            });

                            scrollAnimation.onend(scrollEnd);

                            scrollAnimation.play();
                        } else {
                            // css
                            var offset = s1.toFixed(0);
                            setTransitionStyle(that, (t1/1000).toFixed(2) + 's', 'cubic-bezier(' + timeFunction1 + ')');
                            setTransformStyle(that, offset);
                            setTransitionEndHandler(scrollEnd, (t1/1000).toFixed(2) * 1000);
                        }
                    } else {
                        scrollEnd();
                    }
                } else if (s0 !== s2) {
                    debugLog('惯性滚动', 's=' + s2.toFixed(0), 't=' + ((t1 + t2) / 1000).toFixed(2));

                    if (options.useFrameAnimation) {
                        var _s = s2 - s0;
                        var bezier = lib.cubicbezier.easeOut;
                        scrollAnimation = new lib.animation((t1 + t2).toFixed(0), bezier, 0, function(i1, i2) {
                            var offset = s0 + _s * i2;
                            setTransformStyle(that, offset.toFixed(2));
                            fireEvent(that, 'scrolling',{
                                afterFlick: true
                            });
                        });

                        scrollAnimation.onend(function() {
                            if (!that.enabled) {
                                return;
                            }

                            var _s = s1 - s2;
                            var bezier = lib.cubicbezier.ease;
                            scrollAnimation = new lib.animation(400, bezier, 0, function(i1, i2) {
                                var offset = s2 + _s * i2;
                                setTransformStyle(that, offset.toFixed(2));
                                fireEvent(that, 'scrolling',{
                                    afterFlick: true
                                });
                            });

                            scrollAnimation.onend(scrollEnd);

                            scrollAnimation.play();
                        });

                        scrollAnimation.play();
                    } else {
                        var offset = s2.toFixed(0);
                        setTransitionStyle(that, ((t1 + t2) / 1000).toFixed(2) + 's', 'ease-out');
                        setTransformStyle(that, offset);

                        setTransitionEndHandler(function(e) {
                            if (!that.enabled) {
                                return;
                            }

                            debugLog('惯性回弹', 's=' + s1.toFixed(0), 't=400');

                            if (s2 !== s1) {
                                var offset = s1.toFixed(0);
                                setTransitionStyle(that, '0.4s', 'ease');
                                setTransformStyle(that, offset);
                                setTransitionEndHandler(scrollEnd, 400);
                            } else {
                                scrollEnd();
                            }
                        }, ((t1 + t2) / 1000).toFixed(2) * 1000);
                    }
                } else {
                    scrollEnd();
                }
            } else {
                debugLog('惯性计算没有超出边缘');
                var timeFunction = motion0.generateCubicBezier();

                if (options.useFrameAnimation) {
                    // frame;
                    var _s = s - s0;
                    var bezier = lib.cubicbezier(timeFunction[0][0], timeFunction[0][1], timeFunction[1][0], timeFunction[1][1]);
                    scrollAnimation = new lib.animation(t0.toFixed(0), bezier, 0, function(i1, i2) {
                        var offset = (s0 + _s * i2).toFixed(2);
                        setTransformStyle(that, offset);
                        fireEvent(that, 'scrolling',{
                            afterFlick: true
                        });
                    });

                    scrollAnimation.onend(scrollEnd);

                    scrollAnimation.play();
                } else {
                    // css
                    var offset = s.toFixed(0);
                    setTransitionStyle(that, (t0 / 1000).toFixed(2) + 's', 'cubic-bezier(' + timeFunction + ')');
                    setTransformStyle(that, offset);
                    setTransitionEndHandler(scrollEnd, (t0 / 1000).toFixed(2) * 1000);
                }
            }


            isFlickScrolling = true;
            if (!options.useFrameAnimation) {
                lib.animation.requestFrame(function() {
                    if (isScrolling && isFlickScrolling && that.enabled) {
                        fireEvent(that, 'scrolling', {
                            afterFlick: true
                        });
                        lib.animation.requestFrame(arguments.callee);
                    }
                });
            }
        }
    }

    function scrollEnd() {
        if (!that.enabled) {
            return;
        }

        cancelScrollEnd = false;

        setTimeout(function() {
            if (!cancelScrollEnd && isScrolling) {
                isScrolling = false;
                isFlickScrolling = false;

                if (options.useFrameAnimation) {
                    scrollAnimation && scrollAnimation.stop();
                    scrollAnimation = null;
                } else {
                    setTransitionStyle(that, '', '');
                }
                fireEvent(that, 'scrollend');
            }
        }, 50);
    }

    var proto = {
        init: function() {
            this.enable();
            this.refresh();
            this.scrollTo(0);
            return this;
        },

        enable: function() {
            this.enabled = true;
            return this;
        },

        disable: function() {
            var el = this.element;
            this.enabled = false;

            if (this.options.useFrameAnimation) {
                scrollAnimation && scrollAnimation.stop();
            } else {
                lib.animation.requestFrame(function() {
                    el.style[stylePrefix + 'Transform'] = getComputedStyle(el)[stylePrefix + 'Transform'];
                });
            }

            return this;
        },

        getScrollWidth: function() {
            return getBoundingClientRect(this.element).width;
        },

        getScrollHeight: function() {
            return getBoundingClientRect(this.element).height;
        },

        getScrollLeft: function() {
            return -getTransformOffset(this).x - this.options.xPaddingTop;
        },

        getScrollTop: function() {
            return -getTransformOffset(this).y - this.options.yPaddingTop;
        },

        getMaxScrollLeft: function() {
            return -that.maxScrollOffset - this.options.xPaddingTop;
        },

        getMaxScrollTop: function() {
            return -that.maxScrollOffset - this.options.yPaddingTop;
        },

        getBoundaryOffset: function() {
            return Math.abs(getBoundaryOffset(this, getTransformOffset(this)[this.axis]) || 0);
        },

        refresh: function() {
            var el = this.element;
            var isVertical = (this.axis === 'y');
            var type = isVertical?'height':'width';

            if (this.options[type] != null) {
                // use options
                el.style[type] = this.options[type] + 'px';
            } else if (!!this.options.useElementRect) {
                el.style[type] = 'auto';
                el.style[type] = getBoundingClientRect(el)[type] + 'px';
            } else if (el.childElementCount > 0) {
                var range
                var rect;
                var firstEl = el.firstElementChild;
                var lastEl = el.lastElementChild;

                if (document.createRange && !this.options.ignoreOverflow) {
                    // use range
                    range = document.createRange();
                    range.selectNodeContents(el);
                    rect = getBoundingClientRect(range);
                }

                if (rect) {
                    el.style[type] = rect[type] + 'px';
                } else {
                    // use child offsets
                    while (firstEl) {
                        if (getBoundingClientRect(firstEl)[type] === 0 && firstEl.nextElementSibling) {
                            firstEl = firstEl.nextElementSibling;
                        } else {
                            break;
                        }
                    }

                    while (lastEl && lastEl !== firstEl) {
                        if (getBoundingClientRect(lastEl)[type] === 0 && lastEl.previousElementSibling) {
                            lastEl = lastEl.previousElementSibling;
                        } else {
                            break;
                        }
                    }

                    el.style[type] = (getBoundingClientRect(lastEl)[isVertical?'bottom':'right'] -
                        getBoundingClientRect(firstEl)[isVertical?'top':'left']) + 'px'; 
                }
            }

            this.transformOffset = getTransformOffset(this);
            this.minScrollOffset = getMinScrollOffset(this);
            this.maxScrollOffset = getMaxScrollOffset(this);
            this.scrollTo(-this.transformOffset[this.axis] - this.options[this.axis + 'PaddingTop']);
            fireEvent(this, 'contentrefresh');

            return this;
        },

        offset: function(childEl) {
            var elRect = getBoundingClientRect(this.element);
            var childRect = getBoundingClientRect(childEl);
            if (this.axis === 'y') {
                var offsetRect = {
                        top: childRect.top - elRect.top - this.options.yPaddingTop,
                        left: childRect.left - elRect.left,
                        right: elRect.right - childRect.right,
                        width: childRect.width,
                        height: childRect.height
                    };

                offsetRect.bottom = offsetRect.top + offsetRect.height;
            } else {
                var offsetRect = {
                        top: childRect.top - elRect.top,
                        bottom: elRect.bottom - childRect.bottom,
                        left: childRect.left - elRect.left - this.options.xPaddingTop,
                        width: childRect.width,
                        height: childRect.height
                    };

                offsetRect.right = offsetRect.left + offsetRect.width;
            }
            return offsetRect;
        },

        getRect: function(childEl) {
            var viewRect = getBoundingClientRect(this.viewport);
            var childRect = getBoundingClientRect(childEl);
            if (this.axis === 'y') {
                var offsetRect = {
                        top: childRect.top - viewRect.top,
                        left: childRect.left - viewRect.left,
                        right: viewRect.right - childRect.right,
                        width: childRect.width,
                        height: childRect.height
                    };

                offsetRect.bottom = offsetRect.top + offsetRect.height;
            } else {
                var offsetRect = {
                        top: childRect.top - viewRect.top,
                        bottom: viewRect.bottom - childRect.bottom,
                        left: childRect.left - viewRect.left,
                        width: childRect.width,
                        height: childRect.height
                    };

                offsetRect.right = offsetRect.left + offsetRect.width;
            }
            return offsetRect;
        },

        isInView: function(childEl) {
            var viewRect = this.getRect(this.viewport);
            var childRect = this.getRect(childEl);
            if (this.axis === 'y') {
                return viewRect.top < childRect.bottom && viewRect.bottom > childRect.top;
            } else {
                return viewRect.left < childRect.right && viewRect.right > childRect.left;
            }
        },

        scrollTo: function(offset, isSmooth) {
            var that = this;
            var element = this.element;

            offset = -offset - this.options[this.axis + 'PaddingTop'];
            offset = touchBoundary(this, offset);

            isScrolling = true;
            if (isSmooth === true) {
                if (this.options.useFrameAnimation) {
                    var s0 = getTransformOffset(that)[this.axis];
                    var _s = offset - s0;
                    scrollAnimation = new lib.animation(400, lib.cubicbezier.ease, 0, function(i1, i2) {
                        var offset = (s0 + _s * i2).toFixed(2);
                        setTransformStyle(that, offset);
                        fireEvent(that, 'scrolling');
                    });

                    scrollAnimation.onend(scrollEnd);

                    scrollAnimation.play();
                } else {
                    setTransitionStyle(that, '0.4s', 'ease');
                    setTransformStyle(that, offset);
                    setTransitionEndHandler(scrollEnd, 400);

                    lib.animation.requestFrame(function() {
                        if (isScrolling && that.enabled) {
                            fireEvent(that, 'scrolling');
                            lib.animation.requestFrame(arguments.callee);
                        }
                    });
                }
            } else {
                if (!this.options.useFrameAnimation) {
                    setTransitionStyle(that, '', '');
                }
                setTransformStyle(that, offset);
                scrollEnd();
            }

            return this;
        },

        scrollToElement: function(childEl, isSmooth) {
            var offset = this.offset(childEl);
            offset = offset[this.axis === 'y'?'top':'left'];
            return this.scrollTo(offset, isSmooth);
        },

        getViewWidth: function() {
            return getBoundingClientRect(this.viewport).width;
        },

        getViewHeight: function() {
            return getBoundingClientRect(this.viewport).height;
        },

        addPulldownHandler: function(handler) {
            var that = this;
            this.element.addEventListener('pulldownend', function(e) {
                that.disable();
                handler.call(that, e, function() {
                    that.scrollTo(0, true);
                    that.refresh();
                    that.enable();
                });
            }, false);

            return this;
        },

        addPullupHandler: function(handler) {
            var that = this;

            this.element.addEventListener('pullupend', function(e) {
                that.disable();
                handler.call(that, e, function() {
                    that.scrollTo(that.getScrollHeight(), true);
                    that.refresh();
                    that.enable();
                });
            }, false);

            return this;
        },

        addScrollstartHandler: function(handler) {
            var that = this;
            this.element.addEventListener('scrollstart', function(e){
                handler.call(that, e);
            }, false);

            return this;
        },

        addScrollingHandler: function(handler) {
            var that = this;
            this.element.addEventListener('scrolling', function(e){
                handler.call(that, e);
            }, false);

            return this;
        },

        addScrollendHandler: function(handler) {
            var that = this;
            this.element.addEventListener('scrollend', function(e){
                handler.call(that, e);
            }, false);

            return this;
        },

        addContentrenfreshHandler: function(handler) {
            var that = this;
            this.element.addEventListener('contentrefresh', function(e){
                handler.call(that, e);
            }, false);
        },

        addEventListener: function(name, handler, useCapture) {
            var that = this;
            this.element.addEventListener(name, function(e){
                handler.call(that, e);
            }, !!useCapture);
        },

        removeEventListener: function(name, handler) {
            var that = this;
            this.element.removeEventListener(name, function(e){
                handler.call(that, e);
            });
        },

        enablePlugin: function(name, options) {
            var plugin = plugins[name];
            if (plugin && !this.plugins[name]) {
                this.plugins[name] = true;
                options = options || {};
                plugin.call(this, name, options);
            }
            return this;
        }
    }

    for (var k in proto) {
        this[k] = proto[k];
    }
    delete proto;
}

lib.scroll = function(el, options) {
    if (arguments.length === 1 && !(arguments[0] instanceof HTMLElement)) {
        options = arguments[0];
        if (options.scrollElement) {
            el = options.scrollElement;    
        } else if (options.scrollWrap) {
            el = options.scrollWrap.firstElementChild;
        } else {
            throw new Error('no scroll element');
        }
    }

    if (!el.parentNode) {
        throw new Error('wrong dom tree');
    }
    if (options && options.direction && ['x', 'y'].indexOf(options.direction) < 0) {
        throw new Error('wrong direction');
    }

    var scroll;
    if (options.downgrade === true && lib.scroll.downgrade) {
        scroll = lib.scroll.downgrade(el, options);
    } else {
        if (el.scrollId) {
            scroll = scrollObjs[el.scrollId];
        } else {
            scroll = new Scroll(el, options);
        }
    }
    return scroll;
}

lib.scroll.plugin = function(name, constructor) {
    if (constructor) {
        name = name.split(',');
        name.forEach(function(n) {
            plugins[n] = constructor;
        });
    } else {
        return plugins[name];
    }
}

})(window, window['lib']||(window['lib']={}));

;(function(win, ctrl) {
    var isIEMobile = win.navigator.userAgent.match(/IEMobile\/([\d\.]+)/);
    var stylePrefix = !!isIEMobile?'ms':'webkit';

    var incId = 0;
    function Loading(element, options) {
        var that = this;
        var id = Date.now() + '-' + (++incId);
        var root = document.createDocumentFragment();

        if (arguments.length === 1 && !(arguments[0] instanceof HTMLElement)) {
            options = arguments[0];
            element = null;
        }
        if (!element) {
            element = document.createElement('div');
            root.appendChild(element);
        }
        options = options || {};

        element.setAttribute('data-ctrl-name', 'loading');
        element.setAttribute('data-ctrl-id', id);
        element.innerHTML = '<div><canvas></canvas><span class="arrow"></span></div><span class="text"></span>';

        var canvas, context, radius, lineWidth, startAngle, perAngle, isInit = false;
        var canvasPixelRatio = 2;
        function init() {
            if (!isInit) {
                isInit = true;
                canvas = element.querySelector('canvas');
                context = canvas.getContext('2d');
                startAngle = 0.13373158940994154;
                perAngle = 0.06015722128359704;
            }

            var rect = canvas.getBoundingClientRect();
            if (canvas.width !== rect.width * canvasPixelRatio || canvas.height !== rect.height * canvasPixelRatio) {
                canvas.width = rect.width * canvasPixelRatio;
                canvas.height = rect.height * canvasPixelRatio;                
                radius = rect.width / 2;
                lineWidth = radius / 15;
            }
        }

        function spin() {
            if (mode !== 'spin') return;

            init();
            var offset = 0;

            lib.animation.requestFrame(function() {
                if (mode !== 'spin') return;                

                context.clearRect(0, 0, canvas.width, canvas.height);
                context.beginPath();
                context.arc(radius * canvasPixelRatio, radius * canvasPixelRatio, (radius - lineWidth) * canvasPixelRatio, -startAngle - Math.PI / 2 - offset, -startAngle - Math.PI / 2 - perAngle * 100 - offset, true);
                context.lineWidth = lineWidth * canvasPixelRatio;
                context.strokeStyle = '#ff5000';
                context.stroke();
                context.closePath();
                offset += (Math.PI * 4 / 60);
                lib.animation.requestFrame(arguments.callee);
            });
        }

        function draw(per) {
            if (mode !== 'draw') return;

            init();

            if (per > 100) {
                per = 100;
            }

            context.clearRect(0, 0, canvas.width * canvasPixelRatio, canvas.height * canvasPixelRatio);
            context.beginPath();
            context.arc(radius * canvasPixelRatio, radius * canvasPixelRatio, (radius - lineWidth) * canvasPixelRatio, -startAngle - Math.PI / 2, -startAngle - Math.PI / 2 - perAngle * per, true);
            context.lineWidth = lineWidth * canvasPixelRatio;
            context.strokeStyle = '#ff5000';
            context.stroke();
            context.closePath();
        }

        function showArrow() {
            var arrow = element.querySelector('.arrow');
            arrow.style.cssText = 'display: block';
        }

        function hideArrow() {
            var arrow = element.querySelector('.arrow');

            arrow.style[stylePrefix + 'Transform'] = 'scale(1)';
            arrow.style.opacity = '1';
            var anim = new lib.animation(400, lib.cubicbezier.easeIn, 0, function(i1, i2) {
                arrow.style[stylePrefix + 'Transform'] = 'scale(' + (1 - 0.5 * i2) + ')';
                arrow.style.opacity = (1 - i2) + '';
            });
            anim.onend(function() {
                arrow.style.cssText = 'display:none';
            });
            anim.play();
        }

        Object.defineProperty(this, 'bgcolor', {
            get: function() {
                return element.style.backgroundColor;
            },
            set: function(v) {
                if (typeof v !== 'string') {
                    throw new Error('Non expected value');
                } else {
                    element.style.backgroundColor = v;
                }
            }
        });

        Object.defineProperty(this, 'text', {
            get: function() {
                return element.querySelector('.text').textContent;
            },
            set: function(v) {
                if (typeof v !== 'string') {
                    throw new Error('Non expected value');
                } else {
                    var divEl = element.querySelector('div');
                    var textEl = element.querySelector('.text');
                    if (v) {
                        element.style[stylePrefix + 'BoxPack'] = '';
                        divEl.style.marginLeft = '';
                        textEl.style.display = 'block';
                        textEl.textContent = v;
                    } else {
                        element.style[stylePrefix + 'BoxPack'] = 'center';
                        divEl.style.marginLeft = '0';
                        textEl.style.display = 'none';
                        textEl.textContent = '';
                    }
                }
            }
        });

        var mode = '';
        Object.defineProperty(this, 'mode', {
            get: function() {
                return mode;
            },
            set: function(v) {
                if (!v && typeof v !== 'string' && ['draw', 'spin'].indexOf(v) < 0) {
                    throw new Error('Non expected value');
                } else {
                    mode = v;
                    if (mode === 'spin') {
                        if (arrowDirection) {
                            hideArrow();
                        }
                        spin();
                    } else if (mode === 'draw') {
                        showArrow();
                        draw(0);
                    }
                }
            }
        });

        var per = 0;
        Object.defineProperty(this, 'per', {
            get: function() {
                return per;
            },
            set: function(v) {
                if (mode !== 'draw') {
                    throw new Error('only work under "draw" mode');
                }

                if (!v && typeof v !== 'number' && v < 0 && v > 100) {
                    throw new Error('Non expected value');
                } else {
                    draw(v);              
                }
            }
        });

        var arrowDirection = '';
        Object.defineProperty(this, 'arrowDirection', {
            get: function() {
                return arrowDirection;
            },
            set: function(v) {
                if (!v && typeof v !== 'string' &&  ['up', 'down', ''].indexOf(v) < 0) {
                    throw new Error('Non expected value');
                } else {
                    arrowDirection = v;
                    element.querySelector('.arrow').className = 'arrow ' + v;
                }
            }
        });

        this.remove = function() {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }

        this.element = element;
        this.root = root;
    }

    ctrl.loading = Loading;

})(window, window['ctrl'] || (window['ctrl'] = {}));
;(function (win, lib, ctrl) {
var doc = win.document;
var ua = win.navigator.userAgent;
var Firefox = !!ua.match(/Firefox/i);
var IEMobile = !!ua.match(/IEMobile/i);
var cssPrefix = Firefox?'-moz-':IEMobile?'-ms-':'-webkit-';
var stylePrefix = Firefox?'Moz':IEMobile?'ms':'webkit';


function setHTMLElement(parent, child) {
    if (typeof child === 'string') {
        parent.innerHTML = child;
    } else if (child instanceof HTMLElement) {
        parent.innerHTML = '';
        parent.appendChild(child);
    } else if (child instanceof Array || child instanceof NodeList) {
        var fragment = doc.createDocumentFragment();
        Array.prototype.slice.call(child).forEach(function(node) {
            fragment.appendChild(node);
        });
        parent.appendChild(fragment);
    }
}

function getTransformOffset(element) {
    var offset = {x: 0, y: 0}; 
    var transform = getComputedStyle(element)[stylePrefix + 'Transform'];
    var matched;

    if (transform !== 'none') {
        if ((matched = transform.match(/^matrix3d\((?:[-\d.]+,\s*){12}([-\d.]+),\s*([-\d.]+)(?:,\s*[-\d.]+){2}\)/) ||
                transform.match(/^matrix\((?:[-\d.]+,\s*){4}([-\d.]+),\s*([-\d.]+)\)$/))) {
            offset.x = parseFloat(matched[1]) || 0;
            offset.y = parseFloat(matched[2]) || 0;
        }
    }

    return offset;
}

var CSSMatrix = IEMobile?'MSCSSMatrix':'WebKitCSSMatrix';
var has3d = !!Firefox || CSSMatrix in win && 'm11' in new win[CSSMatrix]();
function getTranslate(x, y) {
    x = parseFloat(x);
    y = parseFloat(y);

    if (x != 0) {
        x += 'px';
    }

    if (y != 0) {
        y += 'px';
    }

    if (has3d) {
        return 'translate3d(' + x + ', ' + y + ', 0)';
    } else {
        return 'translate(' + x + ', ' + y + ')';
    }
}

function setTransitionStyle(element, duration, timingFunction) {
    if (arguments.length === 1) {
        element.style[stylePrefix + 'Transition'] = '';    
    } else {
        element.style[stylePrefix + 'Transition'] = cssPrefix + 'transform ' + duration + ' ' + timingFunction + ' 0s';
    }
}

function setTransformStyle(element, x, y) {
    element.style[stylePrefix + 'Transform'] = getTranslate(x, y);
}

var incId = 0;
function ScrollView(root, options) {

    function fireEvent(name, extra) {
        var ev = doc.createEvent('HTMLEvents');
        ev.initEvent(name, false, false);
        if (extra) {
            for (var key in extra) {
                ev[key] = extra[key];
            }
        }
        scroll.element.dispatchEvent(ev);
    }

    var that = this;
    var id = Date.now() + '-' + (++incId);

    if (arguments.length === 1 && !(arguments[0] instanceof HTMLElement)) {
        options = arguments[0];
        root = null;
    }

    options = options || {};
    if (!root) {
        root = doc.createElement('div');
    }
    var scrollWrap = root.firstElementChild || doc.createElement('div');
    var scrollElement = scrollWrap.firstElementChild || doc.createElement('div');
    
    if (!scrollWrap.parentNode) {
        root.appendChild(scrollWrap);
    }

    if (!scrollElement.parentNode) {
        scrollWrap.appendChild(scrollElement);
    }
    
    root.setAttribute('data-ctrl-name', 'scrollview');
    root.setAttribute('data-ctrl-id', id);
    root.setAttribute('data-direction', options.direction !== 'x'?'vertical':'horizontal');
    if (scrollWrap.className.indexOf('scroll-wrap') < 0) {
        scrollWrap.className = scrollWrap.className.split(' ').concat('scroll-wrap').join(' ').replace(/^\s+/, '');    
    }
    if (scrollElement.className.indexOf('scroll-content') < 0) {
        scrollElement.className = scrollElement.className.split(' ').concat('scroll-content').join(' ').replace(/^\s+/, '');    
    }
    
    options.scrollElement = scrollElement;
    options.scrollWrap = scrollWrap;

    var scroll = new lib.scroll(options);

    this.scrollWrap = scrollWrap;
    this.scrollElement = scrollElement;
    this.scroll = scroll;
    this.root = this.element = root;   

    for (var name in scroll) {
        void function(name) {
            if (typeof scroll[name] === 'function') {
                that[name] = function() {
                    return scroll[name].apply(scroll, arguments);
                }
            } else {
                Object.defineProperty(that, name, {
                    get: function() {
                        return scroll[name];
                    },
                    set: function(v) {
                        scroll[name] = v;
                    }
                })
            }
        }(name);
    }

    Object.defineProperty(this, 'forceRepaint', {
        value: new ForceRepaint(this)
    });

    Object.defineProperty(this, 'fixed', {
        value: new Fixed(this)
    });

    Object.defineProperty(this, 'lazyload', {
        value: new Lazyload(this)
    });

    Object.defineProperty(this, 'sticky', {
        value: new Sticky(this)
    });

    Object.defineProperty(this, 'pullRefresh', {
        value: new Refresh(this)
    });

    // refersh init
    (function() {
        if (scroll.axis !== 'y') return;

        var height = win.dpr?win.dpr * 60:60;
        var processingText = '下拉即可刷新...';
        var refreshText = '正在刷新...';

        var refreshLoading = new ctrl.loading();
        refreshLoading.arrowDirection = 'down';
        refreshLoading.mode = 'draw';
        refreshLoading.text = processingText;
        var element = refreshLoading.element;

        that.pullRefresh.element = element;
        that.pullRefresh.height = height;
        that.pullRefresh.processingHandler = function(offset) {
            if (refreshLoading.mode !== 'draw') {
                refreshLoading.mode = 'draw';
            }
            if (refreshLoading.text !== processingText) {
                refreshLoading.text = processingText;
            }
            refreshLoading.per = Math.round(offset/height * 100);
        }
        that.pullRefresh.refreshHandler = function(done) {
            var isDone = false;
            refreshLoading.text = refreshText;
            refreshLoading.mode = 'spin';
            that.pullRefresh.handler && that.pullRefresh.handler(function () {
                if (isDone) return;
                isDone = true;
                done();
            });
        }
    })();

    Object.defineProperty(this, 'pullUpdate', {
        value: new Update(this)
    });

    // update init
    (function() {
        if (scroll.axis !== 'y') return;

        var height = win.dpr?win.dpr * 60:60;
        var processingText = '上拉加载更多...';
        var updateText = '正在加载...';

        var updateLoading = new ctrl.loading();
        updateLoading.arrowDirection = 'up';
        updateLoading.mode = 'draw';
        updateLoading.text = processingText;
        var element = updateLoading.element;

        that.pullUpdate.element = element;
        that.pullUpdate.height = height;

        that.pullUpdate.processingHandler = function(offset) {
            if (updateLoading.mode !== 'draw') {
                updateLoading.mode = 'draw';
            }
            if (updateLoading.text !== processingText) {
                updateLoading.text = processingText;
            }
            updateLoading.per = Math.round(offset/height * 100);
        }

        that.pullUpdate.updateHandler = function(done) {
            var isDone = false;
            updateLoading.text = updateText;
            updateLoading.mode = 'spin';
            that.pullUpdate.handler && that.pullUpdate.handler(function () {
                if (isDone) return;
                isDone = true;
                done();
            });
        }
    })();

    Object.defineProperty(this, 'content', {
        get: function() {
            return Array.prototype.slice.call(element.childNodes);
        },
        set: function(content) {
            setHTMLElement(scrollElement, content);
        }
    });
}

function ForceRepaint(view) {
    var scroll = view.scroll;
    var forceRepaintElement = doc.createElement('div');
    forceRepaintElement.className = 'force-repaint';
    forceRepaintElement.style.cssText = 'position: absolute; top: 0; left: 0; width: 0; height: 0; font-size: 0; opacity: 1;';
    view.root.appendChild(forceRepaintElement);

    var enable = false;
    Object.defineProperty(this, 'enable', {
        get: function() {
            return enable;
        },
        set: function(v) {
            enable = v;
        }
    }, false);

    Object.defineProperty(this, 'element', {
        value: forceRepaintElement
    });

    scroll.addScrollingHandler(function () {
        if (!enable) return;
        forceRepaintElement.style.opacity = Math.abs(parseInt(forceRepaintElement.style.opacity) - 1) + '';
    });
}

function Fixed(view) {
    var that = this;
    var scroll = view.scroll;
    var fragment = doc.createDocumentFragment();
    var topFixedElement;
    var bottomFixedElement;
    var leftFixedElement;
    var rightFixedElement;

    var enable = false;
    Object.defineProperty(that, 'enable', {
        get: function() {
            return enable;
        },
        set: function(v) {
            enable = v;
            if (!!enable) {
                if (topFixedElement) {
                    if (!topFixedElement.parentNode) {
                        view.root.insertBefore(topFixedElement, view.scrollWrap);
                    }
                    topFixedElement.style.display = 'block';   
                }
                if (bottomFixedElement) {
                    if (!bottomFixedElement.parentNode) {
                        view.root.appendChild(bottomFixedElement);
                    }
                    bottomFixedElement.style.display = 'block';   
                }
                if (leftFixedElement) {
                    if (!leftFixedElement.parentNode) {
                        view.root.insertBefore(leftFixedElement, view.scrollWrap);
                    }
                    leftFixedElement.style.display = 'block';   
                }
                if (rightFixedElement) {
                    if (!rightFixedElement.parentNode) {
                        view.root.appendChild(rightFixedElement);
                    }
                    rightFixedElement.style.display = 'block';   
                }
            } else {
                topFiexElement && (topFixedElement.style.display = 'none');
                bottomFixedElement && (bottomFixedElement.style.display = 'none');
                leftFixedElement && (leftFixedElement.style.display = 'none');
                rightFixedElement && (rightFixedElement.style.display = 'none');
            }
        }
    });

    if (scroll.axis === 'y') {
        topFixedElement = doc.createElement('div');
        topFixedElement.className = 'top-fixed';
        topFixedElement.style.cssText = 'left: 0; top: 0; width: 100%;';
        Object.defineProperty(that, 'topElement', {
            get: function() {
                return topFixedElement;
            },
            set: function(v) {
                setHTMLElement(topFixedElement, v);
            }
        });
        Object.defineProperty(that, 'topOffset', {
            set: function(v) {
                topFixedElement.style.top = v + 'px';
            }
        });

        bottomFixedElement = this.bottomFixedElement = doc.createElement('div');
        bottomFixedElement.className = 'bottom-fxied';
        bottomFixedElement.style.cssText = 'left: 0; bottom: 0; width: 100%;';
        Object.defineProperty(that, 'bottomElement', {
            get: function() {
                return bottomFixedElement;
            },
            set: function(v) {
                setHTMLElement(bottomFixedElement, v);
            }
        });
        Object.defineProperty(that, 'bottomOffset', {
            set: function(v) {
                bottomFixedElement.style.top = v + 'px';
            }
        });
    } else {
        leftFixedElement = this.leftFixedElement = doc.createElement('div');
        leftFixedElement.className = 'left-fixed';
        leftFixedElement.style.cssText = 'top: 0; left: 0; height: 100%;';
        Object.defineProperty(that, 'leftElement', {
            get: function() {
                return leftFixedElement;
            },
            set: function(v) {
                setHTMLElement(leftFixedElement, v);
            }
        });
        Object.defineProperty(that, 'leftOffset', {
            set: function(v) {
                leftFixedElement.style.left = v + 'px';
            }
        });

        rightFixedElement = this.rightFixedElement = doc.createElement('div');
        rightFixedElement.className = 'right-fxied';
        rightFixedElement.style.cssText = 'top: 0; right: 0; height: 100%;';
        Object.defineProperty(that, 'rightElement', {
            get: function() {
                return rightFixedElement;
            },
            set: function(v) {
                setHTMLElement(rightFixedElement, v);
            }
        });
        Object.defineProperty(that, 'rightOffset', {
            set: function(v) {
                rightFixedElement.style.right = v + 'px';
            }
        });
    }
}

function Lazyload(view) {
    var that = this;
    var scroll = view.scroll;
    var limit = 4;
    var waitingQueue = [];
    var loadingCount = 0;
    var loaded = {};

    var isRunningLoadingQueue = false;
    function runLoadingQueue() {
        if (isRunningLoadingQueue) return;
        isRunningLoadingQueue = true;

        if (loadingCount < limit && waitingQueue.length > 0) {
            var url = waitingQueue.shift();
            loadingCount++;

            var img = new Image();
            img.onload = img.onreadystatechange = function() {
                if (loaded[url] !== true) {
                    loaded[url].forEach(function(cb) {
                        cb && cb(url);
                    });
                    loaded[url] = true;
                    loadingCount--;
                }
                runLoadingQueue();
            }
            img.src = url;
            runLoadingQueue();
        }

        isRunningLoadingQueue = false;
    }

    function load(url, callback) {
        if (loaded[url] ===  true) {
            return callback(url);
        } else if (loaded[url]) {
            loaded[url].push(callback);
        } else {
            loaded[url] = [callback];
            waitingQueue.push(url);
        }
        runLoadingQueue();
    }

    function checkLazyload(){
        if (!enable) return;

        var elements = Array.prototype.slice.call(scroll.element.querySelectorAll('.lazy, *[lazyload="true"]'));

        elements.filter(function(el){
            return scroll.isInView(el);
        }).forEach(function(el){
            var imglist;
            var bglist;

            if (el.tagName.toUpperCase() === 'IMG') {
                imglist = [el];
                bglist = [];
            } else {
                imglist = Array.prototype.slice.call(el.querySelectorAll('img[data-src]'));
                bglist = Array.prototype.slice.call(el.querySelectorAll('*[data-image]'));
                if (el.hasAttribute('data-image')) {
                    bglist.push(el);
                }
            }

            imglist.forEach(function(img) {
                var src = img.getAttribute('data-src');
                if (src) {
                    img.removeAttribute('data-src');
                    load(src, function() {
                        img.src = src;
                    });
                }
            });

            bglist.forEach(function(bg) {
                var image = bg.getAttribute('data-image');
                if (image) {
                    bg.removeAttribute('data-image');
                    load(image, function() {
                        bg.style.backgroundImage = 'url(' + image + ')';    
                    });
                }
            });

            lazyloadHandler && lazyloadHandler(el);
            el.className = el.className.split(' ').filter(function(name) {return name !== 'lazy'}).join(' ');
            el.removeAttribute('lazyload');
        });
    }

    var enable;
    Object.defineProperty(that, 'enable', {
        get: function() {
            return enable;
        },
        set: function(v) {
            enable = v;
        }
    });


    var lazyloadHandler;
    Object.defineProperty(that, 'handler', {
        get: function() {
            return lazyloadHandler;
        },
        set: function(v) {
            lazyloadHandler = v;
        }
    });

    var realtime;
    Object.defineProperty(that, 'realtime', {
        get: function() {
            return realtime;
        },
        set: function(v) {
            realtime = !!v;
            if (realtime) {
                view.forceRepaint.enable = true;
            }
        }
    });

    scroll.addScrollingHandler(function(){
        if (realtime) {
            checkLazyload();    
        }
    });

    scroll.addScrollendHandler(function(){
        checkLazyload();
    });

    scroll.addContentrenfreshHandler(function() {
        checkLazyload();
    });

    lib.animation.requestFrame(function(){
        checkLazyload();
    });

    view.checkLazyload = checkLazyload;
}

function Sticky(view) {
    var that = this;
    var scroll = view.scroll;
    
    var stickyWrapElement = doc.createElement('div');
    stickyWrapElement.className = 'sticky';
    stickyWrapElement.style.cssText = 'z-index:9; position: absolute; left: 0; top: 0;' + cssPrefix + 'transform: translateZ(9px);';
    if (scroll.axis === 'y') {
        stickyWrapElement.style.width = '100%';
    } else {
        stickyWrapElement.style.height = '100%';
    }

    Object.defineProperty(this, 'offset', {
        set: function(v) {
            if (scroll.axis ===  'y') {
                stickyWrapElement.style.top = v + 'px';
            } else {
                stickyWrapElement.style.left = v + 'px';
            }
        }
    });

    var enable;
    Object.defineProperty(this, 'enable', {
        get: function() {
            return enable;
        },
        set: function(v) {
            enable = !!v;
            if (enable) {
                if (!stickyWrapElement.parentNode) {
                    scroll.viewport.appendChild(stickyWrapElement);
                }
                stickyWrapElement.style.display = 'block';
            } else {
                stickyWrapElement.style.display = 'none';
            }
        }
    });

    var stickyList = [];

    function checkSticky() {
        if (!enable) return;

        Array.prototype.slice.call(scroll.element.querySelectorAll('.sticky, *[sticky="true"]')).forEach(function(el) {
            el.className = el.className.split(' ').filter(function(name) {return name !== 'sticky'}).join(' ');
            el.setAttribute('sticky', 'initialized');
            var offset = scroll.offset(el);
            var top = offset.top;
            for (var i = 0; i <= stickyList.length; i++) {
                if (!stickyList[i] || top < stickyList[i].top) {
                    stickyList.splice(i, 0, {
                        top: top,
                        el: el,
                        pined: el.firstElementChild
                    });
                    break;
                }
            }
        });

        if (stickyList.length) {
            var scrollOffset = scroll.axis === 'y'?scroll.getScrollTop():scroll.getScrollLeft();
            for (var i = 0; i < stickyList.length; i++) {
                if (scrollOffset < stickyList[i][scroll.axis === 'y'?'top':'left']) {
                    break;
                }
            }

            j = i - 1;
            if (j > -1) {
                if (!stickyList[j].pined.parentNode || stickyList[j].pined.parentNode === stickyList[j].el) {
                    stickyWrapElement.innerHTML = '';
                    stickyWrapElement.appendChild(stickyList[j].pined);
                }
            }

            for (j++; j < stickyList.length; j++) {
                if (stickyList[j].pined.parentNode !== stickyList[j].el) {
                    stickyList[j].el.appendChild(stickyList[j].pined);
                }
            }
        }
    }

    view.forceRepaint.enable = true;
    scroll.addScrollingHandler(checkSticky);
    scroll.addScrollendHandler(checkSticky);

    view.checkSticky = checkSticky;
}

function Refresh(view) {
    var that = this;
    var scroll = view.scroll;

    var refreshElement = doc.createElement('div');
    refreshElement.className = 'refresh';
    refreshElement.style.cssText = 'display: none; position: absolute; top: 0; left: 0; width: 0; height: 0; ' + cssPrefix + 'transform: translateZ(9px)';
    if (scroll.axis === 'y') {
        refreshElement.style.width = '100%';
    } else {
        refreshElement.style.height = '100%';
    }

    var enable = false;
    Object.defineProperty(this, 'enable', {
        get: function() {
            return enable;
        },
        set: function(v) {
            enable = v;
            if (!!enable) {
                if (!refreshElement.parentNode) {
                    scroll.viewport.appendChild(refreshElement);
                }
                refreshElement.style.display = 'block';   
            } else {
                refreshElement.style.display = 'none';
            }
        }
    });

    Object.defineProperty(this, 'element', {
        get: function() {
            return refreshElement;
        },
        set: function(v) {
            setHTMLElement(refreshElement, v);
        }
    });

    Object.defineProperty(this, 'offset', {
        set: function(v) {
            if (scroll.axis === 'y') {
                refreshElement.style.top = v + 'px';
            } else {
                refreshElement.style.left = v + 'px';
            }
        }
    });

    var width = 0;
    Object.defineProperty(this, 'width', {
        set: function(v) {
            width = v;
            if (scroll.axis === 'x') {
                refreshElement.style.width = width + 'px';
                refreshElement.style[stylePrefix + 'Transform'] = 'translateX(' + (-width) + 'px) translateZ(9px)';                
            }
        }
    });

    var height = 0;
    Object.defineProperty(this, 'height', {
        set: function(v) {
            height = v;
            if (scroll.axis === 'y') {
                refreshElement.style.height = height + 'px';
                refreshElement.style[stylePrefix + 'Transform'] = 'translateY(' + (-height) + 'px) translateZ(9px)';
            }
        }
    });

    var processingHandler;
    Object.defineProperty(this, 'processingHandler', {
        get: function() {
            return processingHandler;
        },
        set: function(v) {
            processingHandler = v;
        }
    });

    var refreshHandler;
    Object.defineProperty(this, 'refreshHandler', {
        get: function() {
            return refreshHandler;
        },
        set: function(v) {
            refreshHandler = v;
        }
    });

    var isRefresh;

    scroll.addScrollingHandler(function(e) {
        if (!enable || isRefresh) return;

        var offset = scroll.axis === 'y'?scroll.getScrollTop():scroll.getScrollLeft();
        offset = Math.min(offset, 0);

        if (scroll.axis === 'y') {
            refreshElement.style[stylePrefix + 'Transform'] = 'translateY(' + -(height + offset) + 'px) translateZ(9px)';
        } else {
            refreshElement.style[stylePrefix + 'Transform'] = 'translateX(' + -(width + offset) + 'px) translateZ(9px)';
        }

        if (offset < 0) {
            processingHandler && processingHandler(-offset);
        }
    });


    function pullingAnimation(callback) {
        var refreshOffset = getTransformOffset(refreshElement)[scroll.axis];
        var refreshDiff = 0 - refreshOffset;      
        var elementOffset = getTransformOffset(scroll.element)[scroll.axis];
        var elementDiff = (scroll.axis==='y'?height:width) - elementOffset;

        var anim = new lib.animation(400, lib.cubicbezier.ease, 0, function(i1, i2) {
            refreshElement.style[stylePrefix + 'Transform'] = 'translate' + scroll.axis.toUpperCase() + '(' + (refreshOffset + refreshDiff * i2) + 'px) translateZ(9px)';
            scroll.element.style[stylePrefix + 'Transform'] = 'translate' + scroll.axis.toUpperCase() + '(' + (elementOffset + elementDiff * i2) + 'px)';
        });

        anim.onend(callback);

        anim.play();
    }

    function reboundAnimation(callback) {
        var refreshOffset = getTransformOffset(refreshElement)[scroll.axis];
        var refreshDiff = -(scroll.axis==='y'?height:width) - refreshOffset;
        var elementOffset = getTransformOffset(scroll.element)[scroll.axis];
        var elementDiff = - elementOffset;

        var anim = new lib.animation(400, lib.cubicbezier.ease, 0, function(i1, i2) {
            refreshElement.style[stylePrefix + 'Transform'] = 'translate' + scroll.axis.toUpperCase() + '(' + (refreshOffset + refreshDiff * i2) + 'px) translateZ(9px)';
            scroll.element.style[stylePrefix + 'Transform'] = 'translate' + scroll.axis.toUpperCase() + '(' + (elementOffset + elementDiff * i2) + 'px)';
        });

        anim.onend(callback);

        anim.play();
    }

    scroll.addEventListener('pulldownend', function(e) {
        if (!enable || isRefresh) return;
        isRefresh = true;

        var offset = scroll.getBoundaryOffset();
        if (offset > (scroll.axis === 'y'?height:width)) {
            scroll.disable();
            pullingAnimation(function() {
                if (refreshHandler) {
                    refreshHandler(function() {
                        reboundAnimation(function() {                        
                            scroll.refresh();
                            scroll.enable();
                            isRefresh = false;
                        });
                    });    
                } else {
                    reboundAnimation(function() {                        
                        scroll.refresh();
                        scroll.enable();
                        isRefresh = false;
                    });
                }
            });
        } else {
            reboundAnimation(function() {
                isRefresh = false;
            });
        }
    }, false);
}

function Update(view) {
    var that = this;
    var scroll = view.scroll;

    var updateElement = doc.createElement('div');
    updateElement.className = 'update';
    updateElement.style.cssText = 'display: none; position: absolute; bottom: 0; right: 0; width: 0; height: 0; ' + cssPrefix + 'transform: translateZ(9px)';
    if (scroll.axis === 'y') {
        updateElement.style.width = '100%';
    } else {
        updateElement.style.height = '100%';
    }

    var enable = false;
    Object.defineProperty(this, 'enable', {
        get: function() {
            return enable;
        },
        set: function(v) {
            enable = v;
            if (!!enable) {
                if (!updateElement.parentNode) {
                    scroll.viewport.appendChild(updateElement);
                }
                updateElement.style.display = 'block';   
            } else {
                updateElement.style.display = 'none';
            }
        }
    });

    Object.defineProperty(this, 'element', {
        get: function() {
            return updateElement;
        },
        set: function(v) {
            setHTMLElement(updateElement, v);
        }
    });

    Object.defineProperty(this, 'offset', {
        set: function(v) {
            if (scroll.axis === 'y') {
                updateElement.style.bottom = v + 'px';
            } else {
                updateElement.style.right = v + 'px';
            }
        }
    });

    var width = 0;
    Object.defineProperty(this, 'width', {
        set: function(v) {
            width = v;
            if (scroll.axis === 'x') {
                updateElement.style.width = width + 'px';
                updateElement.style[stylePrefix + 'Transform'] = 'translateX(' + (width) + 'px) translateZ(9px)';                
            }
        }
    });

    var height = 0;
    Object.defineProperty(this, 'height', {
        set: function(v) {
            height = v;
            if (scroll.axis === 'y') {
                updateElement.style.height = height + 'px';
                updateElement.style[stylePrefix + 'Transform'] = 'translateY(' + (height) + 'px) translateZ(9px)';
            }
        }
    });

    var processingHandler;
    Object.defineProperty(this, 'processingHandler', {
        get: function() {
            return processingHandler;
        },
        set: function(v) {
            processingHandler = v;
        }
    });

    var updateHandler;
    Object.defineProperty(this, 'updateHandler', {
        get: function() {
            return updateHandler;
        },
        set: function(v) {
            updateHandler = v;
        }
    });

    var isUpdating;
    scroll.addScrollingHandler(function(e) {
        if (!enable) return;

        var offset = scroll.axis === 'y'?scroll.getScrollTop():scroll.getScrollLeft();
        var maxOffset = scroll.axis === 'y'?scroll.getMaxScrollTop():scroll.getMaxScrollLeft();
        offset = Math.max(offset, maxOffset);

        if (scroll.axis === 'y') {
            updateElement.style[stylePrefix + 'Transform'] = 'translateY(' + (maxOffset - offset + height) + 'px) translateZ(9px)';
        } else  {
            updateElement.style[stylePrefix + 'Transform'] = 'translateX(' + (maxOffset - offset + width) + 'px) translateZ(9px)';
        }

        if (isUpdating) return;

        if (offset - maxOffset  < (scroll.axis === 'y'?height:width) * 0.7) {
            processingHandler && processingHandler(offset - maxOffset);
        } else {
            if (updateHandler) {
                isUpdating = true;
                updateHandler(function() {
                    if (scroll.axis === 'y') {
                        updateElement.style[stylePrefix + 'Transform'] = 'translateY(' + (height) + 'px) translateZ(9px)';
                    } else  {
                        updateElement.style[stylePrefix + 'Transform'] = 'translateX(' + (width) + 'px) translateZ(9px)';
                    }
                    scroll.refresh();
                    isUpdating = false;
                });
            }
        }
    });
}

ctrl.scrollview = ScrollView;
})(window, window['lib'], window['ctrl'] || (window['ctrl'] = {}));
;(function (win, lib, ctrl) {
var doc = win.document;
var ua = win.navigator.userAgent;
var Firefox = !!ua.match(/Firefox/i);
var IEMobile = !!ua.match(/IEMobile/i);
var cssPrefix = Firefox?'-moz-':IEMobile?'-ms-':'-webkit-';
var stylePrefix = Firefox?'Moz':IEMobile?'ms':'webkit';

function outputDebug() {
    if (win.console && !!win.console.debuggerMode) {
        var fn = win.console.debug || win.console.info;
        if (fn.apply) {
            fn.apply(win.console, arguments);
        } else {
            fn(arguments);
        }
    }
}

function outputError() {
    if (win.console && !!win.console.debuggerMode) {
        var fn = win.console.error || win.console.info;
        if (fn.apply) {
            fn.apply(win.console, arguments);
        } else {
            fn(arguments);
        }
    }
}

function Page(name, constructor) {
    var that = this;

    this.name = name;

    this.async = function(handler) {
        return function() {
            var deferred = lib.promise.deferred();
            var args = Array.prototype.slice.call(arguments);
            args.push(function() {
                deferred.resolve();
            });
            handler.apply(that, args);
            return deferred.promise();
        }
    }

    this.startup = this.async(function(root, done){done()});
    this.show = this.async(function(root, persisted, done){done()});
    this.hide = this.async(function(root, done){done()});
    this.teardown = this.async(function(root, done){done()});

    constructor && constructor.call(this);
}


var incId = 0;

function PageView(element, options) {
    var that = this;
    var views = [];
    var pages = {};
    var id = Date.now() + '-' + (++incId);
    var root = document.createDocumentFragment();

    if (arguments.length === 1 && !(arguments[0] instanceof HTMLElement)) {
        options = arguments[0];
        element = null;
    }

    if (!element) {
        element = document.createElement('div');
        root.appendChild(element);
    }
    options = options || {};

    element.setAttribute('data-ctrl-name', 'pageview');
    element.setAttribute('data-ctrl-id', id);
    if (!!options.fullscreen) {
        element.className = 'fullscreen';
    }

    function dispatch(name, extra) {
        var ev = document.createEvent('HTMLEvents');
        ev.initEvent(name, false, true);
        if (extra) {
            for (var key in extra) {
                ev[key] = extra[key];
            }
        }
        root.dispatchEvent(ev);
    }

    var currentPromise = lib.promise.resolve();

    function createView(state) {    
        var view = doc.createElement('div');
        view.className = 'view';
        view.setAttribute('id', 'view-' + state.id);

        var context = pages[state.name];
        var promise;
        if (!context) {
            promise = new lib.promise(function(r) {
                // TODO load Script
                r.resolve(context);
            });
        } else {
            promise = lib.promise.resolve(context);
        }

        return promise.then(function(context){
            outputDebug('success:load ' + state.name + ' page');
            view.context = context;
            return lib.promise.resolve(context.startup(view));
        }, function(err){
            outputDebug('failure:load ' + state.name + ' page');
            return lib.promise.reject(false);
        }).then(function() {
            outputDebug('success:call startup on', {create: view});
            return lib.promise.resolve(view);
        }, function(err) {
            outputError('failure:call startup on', err.stack);
            return lib.promise.reject(view);
        });
    }

    function pushView(nextView, curView) {
        var rect = element.getBoundingClientRect();
        var promises = [];
        nextView.style.width = rect.width + 'px';
        nextView.style.height = rect.height + 'px';
        element.appendChild(nextView);

        if (curView) {
            promises.push(new lib.promise(function(r) {
                nextView.style.display = 'block';
                nextView.style[stylePrefix + 'Transform'] = 'translateX(' + rect.width + 'px) translateZ(1px)';
                var anim = new lib.animation(400, lib.cubicbezier.ease, 0, function(i1, i2) {
                    nextView.style[stylePrefix + 'Transform'] = 'translateX(' + (rect.width * (1 - i2)) + 'px) translateZ(1px)';
                });
                anim.onend(function() {
                    nextView.style[stylePrefix + 'Transform'] = '';
                    r.resolve(nextView);
                });
                anim.play();
            }));

            promises.push(new lib.promise(function(r) {
                curView.style.opacity = '1';
                curView.style[stylePrefix + 'Transform'] = 'scale(1) translateZ(0)';
                var anim = new lib.animation(400, lib.cubicbezier.ease, 0, function(i1, i2) {
                    curView.style[stylePrefix + 'Transform'] = 'scale(' + (1 - 0.1 * i2) + ')';
                    curView.style.opacity = (1 - i2) + '';
                });
                anim.onend(function() {
                    curView.style[stylePrefix + 'Transform'] = '';
                    curView.style.opacity = '';
                    curView.style.display = 'none';
                    r.resolve(curView);
                });
                anim.play();
            }));
        } else {
            nextView.style.display = 'block';
            promises.push(lib.promise.resolve(nextView));
        }

        return lib.promise.every.apply(lib.promise, promises);
    }

    function PushExecuter(state){
        this.exec = function(){
            lib.promise.every(createView(state), currentPromise).then(function(args) {
                var nextView = args[0];
                var curView = args[1];
                outputDebug('begin:push animation for', {next:nextView, cur:curView});
                return pushView(nextView, curView);
            }, function(err) {
                return lib.promise.reject(err);
            }).then(function(args) {
                var nextView = args[0];
                var curView = args[1];                
                views.push(nextView);

                outputDebug('end:push animation for', {next:nextView, cur:curView});
                var thenable = curView && curView.context.hide(curView);
                currentPromise = lib.promise.resolve(thenable).then(function() {
                    curView && outputDebug('success:call hide on', {cur:curView});
                    return lib.promise.resolve(nextView.context.show(nextView, false));
                }, function() {
                    curView && outputError('failure:call hide on', {cur:curView});
                    return lib.promise.reject(false);
                }).then(function(){
                    outputDebug('success:call show on', {next:nextView});
                    return lib.promise.resolve(nextView);
                }, function() {
                    outputError('failure:call show on', {next:nextView});
                    return lib.promise.reject(nextView);
                });
            }, function(err) {
                outputError('failure:when push animation', err.stack);
            });       
        }
    }

    function popView(preView, curView) {
        if (!preView.parentNode) {
            element.insertBefore(preView, curView);
        }

        var rect = element.getBoundingClientRect();
        var promises = [];

        promises.push(new lib.promise(function(r) {
            preView.style.opacity = '0';
            preView.style.display = 'block';
            preView.style[stylePrefix + 'Transform'] = 'scale(0.9) translateZ(0)';
            var anim = new lib.animation(400, lib.cubicbezier.ease, 0, function(i1, i2) {
                preView.style[stylePrefix + 'Transform'] = 'scale(' + (0.9 + 0.1 * i2) + ') translateZ(0)';
                preView.style.opacity = i2 + '';
            });
            anim.onend(function() {
                preView.style[stylePrefix + 'Transform'] = '';
                preView.style.opacity = '';
                r.resolve(preView);
            });
            anim.play();
        }));

        promises.push(new lib.promise(function(r){
            curView.style.display = 'block';
            curView.style[stylePrefix + 'Transform'] = 'translateX(0) translateZ(1px)';
            var anim = new lib.animation(400, lib.cubicbezier.ease, 0, function(i1, i2) {
                curView.style[stylePrefix + 'Transform'] = 'translateX(' + (rect.width * i2) + 'px) translateZ(1px)';
            });
            anim.onend(function() {
                curView.style[stylePrefix + 'Transform'] = '';
                element.removeChild(curView);
                r.resolve(curView);
            });
            anim.play();
        }));

        return lib.promise.every.apply(lib.promise, promises);
    }

    function PopExecuter(state){
        this.exec = function(){
            var promise;
            views.pop();

            if (!views.length) {
                promise = createView(state);
            } else {
                promise = lib.promise.resolve(views.pop());
            }

            lib.promise.every(promise, currentPromise).then(function(args) {
                var preView = args[0];
                var curView = args[1];
                outputDebug('begin:pop animation for', {pre:preView, cur:curView});
                return popView(preView, curView);
            }, function(err) {
                return lib.promise.reject(err);
            }).then(function(args) {
                var preView = args[0];
                var curView = args[1];                
                views.push(preView);

                outputDebug('end:pop animation for',  {pre:preView, cur:curView});
                var thenable = curView && curView.context.hide(curView);
                currentPromise = lib.promise.resolve(thenable).then(function() {
                    outputDebug('success:call hide on', {cur:curView});
                    return lib.promise.resolve(preView.context.show(preView, false));
                }, function() {
                    outputError('failure:call hide on', {cur:curView});
                    return lib.promise.reject(false);
                }).then(function(){
                    outputDebug('success:call show on', {pre:preView});
                    return lib.promise.resolve(preView);
                }, function() {
                    outputError('failure:call show on', {pre:preView});
                    return lib.promise.reject(preView);
                });
            }, function(err) {
                outputError('failure:pop pop animation', err.stack);
            })
        }
    }

    function replaceView(newView, curView) {
        var rect = element.getBoundingClientRect();
        var promises = [];
        newView.style.width = rect.width + 'px';
        newView.style.height = rect.height + 'px';
        element.appendChild(newView);

        promises.push(new lib.promise(function(r) {
            newView.style.opacity = '0';
            newView.style.display = 'block';
            newView.style[stylePrefix + 'Transform'] = 'translateZ(1px)';
            var anim = new lib.animation(400, lib.cubicbezier.ease, 0, function(i1, i2) {
                newView.style.opacity = i2 + '';
            });
            anim.onend(function() {
                newView.style.opacity = '';
                newView.style[stylePrefix + 'Transform'] = '';
                r.resolve(newView);
            });
            anim.play();
        }));

        promises.push(new lib.promise(function(r) {
            curView.style.opacity = '1';
            curView.style[stylePrefix + 'Transform'] = 'scale(1) translateZ(0)';
            var anim = new lib.animation(400, lib.cubicbezier.ease, 0, function(i1, i2) {
                curView.style.opacity = (1 - i2) + '';
                curView.style[stylePrefix + 'Transform'] = 'scale(' + (1 - 0.1 * i2) + ')';
            });
            anim.onend(function() {
                curView.style.opacity = '';
                curView.style[stylePrefix + 'Transform'] = '';
                element.removeChild(curView);
                r.resolve(curView);
            });
            anim.play();
        }));

        return lib.promise.every.apply(lib.promise, promises);
    }

    function ReplaceExecuter(state){
        this.exec = function(){
            views.pop();

            lib.promise.every(createView(state), currentPromise).then(function(args) {
                var newView = args[0];
                var curView = args[1];
                outputDebug('begin:replace animation for', {"new":newView, cur:curView});
                return replaceView(newView, curView);
            }, function(err) {
                return lib.promise.reject(err);
            }).then(function(args) {
                var newView = args[0];
                var curView = args[1];
                views.push(newView);

                outputDebug('end:replace animation for', {"new":newView, cur:curView});
                var thenable = curView && curView.context.hide(curView);
                currentPromise = lib.promise.resolve(thenable).then(function() {
                    curView && outputDebug('success:call hide on', {cur:curView});
                    return lib.promise.resolve(newView.context.show(newView, false));
                }, function() {
                    curView && outputError('failure:call hide on', {cur:curView});
                    return lib.promise.reject(false);
                }).then(function(){
                    outputDebug('success:call show on', {"new":newView});
                    return lib.promise.resolve(newView);
                }, function() {
                    outputError('failure:call show on', {"new":newView});
                    return lib.promise.reject(newView);
                });
            }, function(err) {
                outputError('failure:when replace animation', err.stack);
            });       
        }
    }

    this.definePage = function (name, constructor){
        return (pages[name] = new Page(name, constructor));
    }

    this.push = function(name, args, id) {
        new PushExecuter({
            name: name,
            args: args,
            id: id || Date.now()
        }).exec();
    }

    this.pop = function(name, args, id) {
        new PopExecuter({
            name: name,
            args: args,
            id: id || Date.now()
        }).exec();
    }

    this.replace = function(name, args, id) {
        new ReplaceExecuter({
            name: name,
            args: args,
            id: id || Date.now()
        }).exec();
    }

    this.addEventListener = function(name, handler) {
        this.root.addEventListener(name, handler, false);
    }

    this.removeEventListener = function(name, handler) {
        this.root.removeEventListener(name, handler, false);
    }

    this.root = root;
    this.element = element;
}

ctrl.pageview = PageView;

})(window, window['lib'], window['ctrl'] || (window['ctrl'] = {}));