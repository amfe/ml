;(function (win, ctrl) {

var doc = win.document;
var requestAnimation = win.requestAnimation ||
        win.webkitRequestAnimation || 
        function(cb) {
            setTimeout(cb, 16);
        };

function PageView(root) {
    var that = this;
    var wrap = root;
    var current;
    var width = wrap.getBoundingClientRect().width;
    var views = [];
    var pages = {};

    function createView(state, callback) {    
        var view = doc.createElement('div');
        var rect = wrap.getBoundingClientRect();
        view.className = 'view';
        view.style.width = rect.width + 'px';
        view.style.height = rect.height + 'px';
        view.style.overflow = 'hidden';
        view.style.position = 'absolute';
        view.params = state.args;
        view.url = state.name + '?' + state.args.toString();
        
        var meta = pages[state.name];
        if (meta && meta.name) {
            view.meta = meta;
            view.setAttribute('id', 'view-' + state.id);
            meta.startup(view);
        }

        callback && callback(view);
        return view;
    }

    function popAnim(curView, preView, callback) {
        if (!preView.parentNode) {
            wrap.insertBefore(preView, curView);
        }

        curView.style.webkitTransform = 'translateX(0)';
        curView.style.webkitTransition = '-webkit-transform 0.4s ease';
        curView.addEventListener('webkitTransitionEnd', function(e){
            curView.removeEventListener('webkitTransitionEnd', arguments.callee);
            curView.style.webkitTransition = '';
            curView.style.webkitTransform = '';
            wrap.removeChild(curView);
        }, false);

        preView.style.opacity = '0';
        preView.style.display = 'block';
        preView.style.webkitTransform = 'scale(0.9)';
        preView.style.webkitTransition = 'opacity 0.4s ease, -webkit-transform 0.4s ease';
        preView.addEventListener('webkitTransitionEnd', function(e){
            preView.removeEventListener('webkitTransitionEnd', arguments.callee);
            preView.style.opacity = '';
            preView.style.webkitTransform = '';
            preView.style.webkitTransition = '';
        }, false);

        requestAnimation(function(){
            curView.style.webkitTransform = 'translateX(' + width + 'px)';
            preView.style.opacity = '1';
            preView.style.webkitTransform = 'scale(1)';
        });


        setTimeout(callback, 500);
    }

    function PopExecuter(state){
        function onshow(curView, preView, persisted) {
            popAnim(curView, preView, function() {
                curView.meta.hide && curView.meta.hide(curView);
                preView.meta.show && preView.meta.show(preView, persisted);
            });
        }

        this.exec = function(){
            var curView = current;
            views.pop();
            if (!views.length) {
                current = createView(state, function(preView){
                    onshow(curView, preView);
                });
                views.push(preView);
            } else {
                var preView = current = views[views.length - 1];
                onshow(curView, preView, true);
            }
        }
    }

    function pushAnim(nextView, curView, callback) {
        wrap.appendChild(nextView);

        if (curView) {
            nextView.style.webkitTransform = 'translateX(' + width + 'px)';
            nextView.style.webkitTransition = '-webkit-transform 0.4s ease 0';
            nextView.style.display = 'block';
            nextView.addEventListener('webkitTransitionEnd', function(e){
                nextView.removeEventListener('webkitTransitionEnd', arguments.callee);
                nextView.style.webkitTransition = '';
                nextView.style.webkitTransform = '';
            }, false);

            curView.style.opacity = '1';
            curView.style.webkitTransform = 'scale(1)';
            curView.style.webkitTransition = 'opacity 0.4s ease, -webkit-transform 0.4s ease';
            curView.addEventListener('webkitTransitionEnd', function(e){
                curView.removeEventListener('webkitTransitionEnd', arguments.callee);
                curView.style.opacity = '';
                curView.style.webkitTransform = '';
                curView.style.webkitTransition = '';
                curView.style.display = 'none';
            }, false);

            requestAnimation(function(){
                nextView.style.webkitTransform = 'translateX(0)';
                curView.style.opacity = '0';
                curView.style.webkitTransform = 'scale(0.9)';
            }, 10);
        } else {
            nextView.style.display = 'block';
        }

        setTimeout(callback, 500);
    }

    function PushExecuter(state){
        function onshow(nextView, curView) {
            pushAnim(nextView, curView, function() {
                curView && curView.meta.hide && curView.meta.hide(curView);
                nextView.meta.show && nextView.meta.show(nextView);
            });
        }

        this.exec = function(){
            var curView = current;
            current = createView(state, function(nextView) {
                onshow(nextView, curView);
            });
            views.push(current);
        }
    }

    this.definePage = function (meta){
        if(pages[meta.name]) {
            pages[meta.name](meta);
            pages[meta.name] = meta;
        } else {
            pages[meta.name] = meta;
        }
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
}

ctrl.pageview = PageView;

})(window, window['ctrl'] || (window['ctrl'] = {}));