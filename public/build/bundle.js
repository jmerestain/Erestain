
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const prop_values = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.29.0' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src\App.svelte generated by Svelte v3.29.0 */

    const file = "src\\App.svelte";

    function create_fragment(ctx) {
    	let main;
    	let div10;
    	let div6;
    	let h1;
    	let t1;
    	let div4;
    	let div0;
    	let p0;
    	let t3;
    	let div1;
    	let p1;
    	let t5;
    	let div2;
    	let p2;
    	let t7;
    	let div3;
    	let p3;
    	let t9;
    	let div5;
    	let p4;
    	let t10;
    	let span0;
    	let t12;
    	let span1;
    	let t14;
    	let t15;
    	let a;
    	let t17;
    	let div9;
    	let div7;
    	let img0;
    	let img0_src_value;
    	let t18;
    	let p5;
    	let t20;
    	let div8;
    	let img1;
    	let img1_src_value;
    	let t21;
    	let p6;
    	let t23;
    	let footer;
    	let p7;
    	let t25;
    	let p8;

    	const block = {
    		c: function create() {
    			main = element("main");
    			div10 = element("div");
    			div6 = element("div");
    			h1 = element("h1");
    			h1.textContent = "ERESTAIN";
    			t1 = space();
    			div4 = element("div");
    			div0 = element("div");
    			p0 = element("p");
    			p0.textContent = "Blockchain Engineering";
    			t3 = space();
    			div1 = element("div");
    			p1 = element("p");
    			p1.textContent = "Web Development";
    			t5 = space();
    			div2 = element("div");
    			p2 = element("p");
    			p2.textContent = "App Development";
    			t7 = space();
    			div3 = element("div");
    			p3 = element("p");
    			p3.textContent = "Technical Architecture";
    			t9 = space();
    			div5 = element("div");
    			p4 = element("p");
    			t10 = text("You can call me ");
    			span0 = element("span");
    			span0.textContent = "JM";
    			t12 = text(".\n\t\t\t\t\tI am a ");
    			span1 = element("span");
    			span1.textContent = "full stack developer";
    			t14 = text(" from the Philippines;\n\t\t\t\t\tcurrently a sophomore in the Ateneo De Manila University.");
    			t15 = space();
    			a = element("a");
    			a.textContent = "Get in Touch";
    			t17 = space();
    			div9 = element("div");
    			div7 = element("div");
    			img0 = element("img");
    			t18 = space();
    			p5 = element("p");
    			p5.textContent = "Punta Shop";
    			t20 = space();
    			div8 = element("div");
    			img1 = element("img");
    			t21 = space();
    			p6 = element("p");
    			p6.textContent = "Memory Matrix";
    			t23 = space();
    			footer = element("footer");
    			p7 = element("p");
    			p7.textContent = "jose emmanuel n. erestain iv";
    			t25 = space();
    			p8 = element("p");
    			p8.textContent = "+63 998 186 7756";
    			attr_dev(h1, "class", "text-primary text-center text-5xl select-none font-bantayog tracking-wider mt-5 font-bold svelte-16sjn9b");
    			add_location(h1, file, 6, 3, 200);
    			add_location(p0, file, 12, 5, 497);
    			add_location(div0, file, 11, 4, 486);
    			add_location(p1, file, 15, 5, 553);
    			add_location(div1, file, 14, 4, 542);
    			add_location(p2, file, 18, 5, 602);
    			add_location(div2, file, 17, 4, 591);
    			add_location(p3, file, 21, 5, 651);
    			add_location(div3, file, 20, 4, 640);
    			attr_dev(div4, "class", "flex justify-center md:justify-between text-center text-xl gap-2\n\t\t\tfont-bold text-tertiary flex-wrap font-caption items-center select-none svelte-16sjn9b");
    			add_location(div4, file, 9, 3, 328);
    			attr_dev(span0, "class", "font-bold text-secondary svelte-16sjn9b");
    			add_location(span0, file, 27, 21, 944);
    			attr_dev(span1, "class", "font-bold cunderline svelte-16sjn9b");
    			add_location(span1, file, 28, 12, 1006);
    			attr_dev(p4, "class", "text-primary text-3xl w-full mt-5 tracking-wide p-5 rounded-lg\n\t\t\t\tleading-relaxed font-caption md:text-justify text-center mb-10 border-juris svelte-16sjn9b");
    			add_location(p4, file, 25, 4, 768);
    			attr_dev(a, "href", "mailto:jose.erestain@obf.ateneo.edu");
    			attr_dev(a, "class", "px-4 py-3 font-caption text-primary mx-auto\n\t\t\t\tfont-bold tracking-wider text-center max-w-sm svelte-16sjn9b");
    			set_style(a, "background", "#087F8C");
    			add_location(a, file, 31, 4, 1167);
    			attr_dev(div5, "class", "flex flex-col justify-center flex-wrap gap-2");
    			add_location(div5, file, 24, 3, 705);
    			attr_dev(div6, "class", "flex flex-col gap-10");
    			add_location(div6, file, 5, 2, 162);
    			attr_dev(img0, "class", "object-cover w-full h-64 object-top flex-shrink rounded-t-md grayscale svelte-16sjn9b");
    			if (img0.src !== (img0_src_value = "./assets/img/punta_thumb.png")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "alt", "Punta Landing Page");
    			add_location(img0, file, 41, 4, 1539);
    			attr_dev(p5, "class", "bg-secondary text-primary p-2 shadow-lg\n\t\t\t\ttext-center font-caption font-bold rounded-b-md text-lg svelte-16sjn9b");
    			add_location(p5, file, 43, 4, 1694);
    			attr_dev(div7, "class", "flex flex-col max-w-xl");
    			add_location(div7, file, 40, 3, 1498);
    			attr_dev(img1, "class", "object-cover w-full h-64 object-center flex-shrink rounded-t-md grayscale svelte-16sjn9b");
    			if (img1.src !== (img1_src_value = "./assets/img/memory-matrix_thumb.png")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "alt", "Memory Matrix");
    			add_location(img1, file, 49, 4, 1885);
    			attr_dev(p6, "class", "bg-secondary text-primary p-2 shadow-lg\n\t\t\t\ttext-center font-caption font-bold rounded-b-md text-lg svelte-16sjn9b");
    			add_location(p6, file, 51, 4, 2046);
    			attr_dev(div8, "class", "flex flex-col max-w-xl");
    			add_location(div8, file, 48, 3, 1844);
    			attr_dev(div9, "class", "flex flex-wrap mt-10 justify-center lg:justify-between gap-4 items-center mb-10");
    			add_location(div9, file, 39, 2, 1401);
    			attr_dev(div10, "class", "container mx-auto py-4 flex flex-col px-10 between");
    			add_location(div10, file, 4, 1, 95);
    			attr_dev(p7, "class", "font-caption text-gray-600 text-xs text-center svelte-16sjn9b");
    			add_location(p7, file, 59, 2, 2283);
    			attr_dev(p8, "class", "font-caption text-gray-600 text-xs text-center svelte-16sjn9b");
    			add_location(p8, file, 62, 2, 2383);
    			attr_dev(footer, "class", "container mx-auto px-10 flex justify-between pb-5");
    			add_location(footer, file, 58, 1, 2214);
    			attr_dev(main, "class", "h-full w-full min-w-screen min-h-screen px-4 flex flex-col svelte-16sjn9b");
    			add_location(main, file, 3, 0, 20);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div10);
    			append_dev(div10, div6);
    			append_dev(div6, h1);
    			append_dev(div6, t1);
    			append_dev(div6, div4);
    			append_dev(div4, div0);
    			append_dev(div0, p0);
    			append_dev(div4, t3);
    			append_dev(div4, div1);
    			append_dev(div1, p1);
    			append_dev(div4, t5);
    			append_dev(div4, div2);
    			append_dev(div2, p2);
    			append_dev(div4, t7);
    			append_dev(div4, div3);
    			append_dev(div3, p3);
    			append_dev(div6, t9);
    			append_dev(div6, div5);
    			append_dev(div5, p4);
    			append_dev(p4, t10);
    			append_dev(p4, span0);
    			append_dev(p4, t12);
    			append_dev(p4, span1);
    			append_dev(p4, t14);
    			append_dev(div5, t15);
    			append_dev(div5, a);
    			append_dev(div10, t17);
    			append_dev(div10, div9);
    			append_dev(div9, div7);
    			append_dev(div7, img0);
    			append_dev(div7, t18);
    			append_dev(div7, p5);
    			append_dev(div9, t20);
    			append_dev(div9, div8);
    			append_dev(div8, img1);
    			append_dev(div8, t21);
    			append_dev(div8, p6);
    			append_dev(main, t23);
    			append_dev(main, footer);
    			append_dev(footer, p7);
    			append_dev(footer, t25);
    			append_dev(footer, p8);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {
    		name: 'world'
    	}
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
