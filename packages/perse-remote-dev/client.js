window.__ModuleLoader__.load({
	id: "perse-remote-dev",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		// \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		let zod = require("zod");
		let react = require("react");
		react = __toESM(react, 1);
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let _deepseek_ai_dsh_api_session_controller_client = require("@deepseek-ai/dsh-api-session-controller/client");
		require("@deepseek-ai/cordis");
		// node_modules/@deepseek-ai/dsh-typert-protocol/lib/types/remote-info.js
		/** Lazy assembly of generated Remote definitions using caller-supplied Zod; no runtime imports. */
		/**
		* Retain one generated definition per endpoint without constructing parsers or projections.
		* The class instance builds its shared descriptor/method index on first access;
		* input schemas and JSON Schema projections are cached only when requested.
		* @param spec - compiler-produced method facts and Zod factories.
		* @param zod - the generated artifact's Zod runtime for named-input parsers.
		* @returns a lazy, mountable info instance with no registration or transport effects.
		*/
		function createTypertRemoteInfo(spec, zod) {
			return new RemoteInfo(spec, zod);
		}
		var RemoteInfo = class {
			spec;
			zod;
			index;
			constructor(spec, zod) {
				this.spec = spec;
				this.zod = zod;
			}
			get package() {
				return this.spec.package;
			}
			get descriptors() {
				return this.resolve().descriptors;
			}
			get methods() {
				return this.resolve().methods;
			}
			resolve() {
				if (this.index !== void 0) return this.index;
				const zod = this.zod;
				const descriptors = [];
				const methods = Object.create(null);
				for (const [endpoint, definition] of Object.entries(this.spec.methods)) {
					const separator = endpoint.indexOf("/");
					const namespace = endpoint.slice(0, separator);
					const method = endpoint.slice(separator + 1);
					const parameters = definition.parameters.map((parameter) => ({
						...parameter,
						wire: parameter.wire ?? parameter.name
					}));
					const descriptor = {
						...definition,
						id: `${this.spec.package}#${endpoint}`,
						namespace,
						method,
						parameters,
						result: definition.result.description === void 0 ? definition.result : new ResultValue(definition.result)
					};
					if (definition.invocation.kind === "direct") {
						const inputs = [];
						methods[endpoint] = Object.assign(descriptor, {
							input(options) {
								const strict = options?.strict === true;
								return inputs[strict ? 1 : 0] ??= new NamedInput(parameters, strict, zod);
							},
							invoke(remote, input, signal) {
								const named = input;
								const values = parameters.map((parameter) => named[parameter.wire]);
								if (definition.cancellation !== void 0) values.push(signal);
								const receiver = Reflect.get(remote, namespace);
								return Reflect.get(receiver, method).apply(receiver, values);
							}
						});
					}
					descriptors.push(descriptor);
				}
				return this.index = {
					descriptors,
					methods
				};
			}
		};
		function optional(parameter) {
			return parameter.source === "json" && parameter.acceptsUndefined === true;
		}
		var NamedInput = class {
			parameters;
			strict;
			zod;
			schema;
			projection;
			constructor(parameters, strict, zod) {
				this.parameters = parameters;
				this.strict = strict;
				this.zod = zod;
			}
			codec(parameter) {
				return this.strict ? parameter.strictCodec : parameter.codec;
			}
			create = () => this.schema ??= this.zod.strictObject(Object.fromEntries(this.parameters.map((parameter) => {
				const value = this.codec(parameter).create();
				return [parameter.wire, optional(parameter) ? value.optional() : value.nonoptional()];
			})));
			get jsonSchema() {
				return this.project().jsonSchema;
			}
			get jsonSchemaError() {
				return this.project().jsonSchemaError;
			}
			project() {
				if (this.projection !== void 0) return this.projection;
				const unavailable = this.parameters.find((parameter) => this.codec(parameter).jsonSchema === void 0);
				if (unavailable !== void 0) return this.projection = { jsonSchemaError: this.codec(unavailable).jsonSchemaError ?? `No JSON Schema for parameter ${unavailable.wire}` };
				return this.projection = { jsonSchema: {
					type: "object",
					properties: Object.fromEntries(this.parameters.map((parameter) => [parameter.wire, {
						...this.codec(parameter).jsonSchema,
						...parameter.description === void 0 ? {} : { description: parameter.description }
					}])),
					required: this.parameters.filter((parameter) => !optional(parameter)).map((parameter) => parameter.wire),
					additionalProperties: false
				} };
			}
		};
		var ResultValue = class {
			spec;
			projection;
			constructor(spec) {
				this.spec = spec;
			}
			get mode() {
				return this.spec.mode;
			}
			get typeSymbol() {
				return this.spec.typeSymbol;
			}
			get create() {
				return this.spec.create;
			}
			get decode() {
				return this.spec.decode;
			}
			get encode() {
				return this.spec.encode;
			}
			get description() {
				return this.spec.description;
			}
			get jsonSchemaError() {
				return this.spec.jsonSchemaError;
			}
			get jsonSchema() {
				if (this.projection === void 0) {
					const schema = this.spec.jsonSchema;
					this.projection = { value: schema === void 0 ? void 0 : {
						...schema,
						description: this.spec.description
					} };
				}
				return this.projection.value;
			}
		};
		// packages/perse-remote-dev/lib/typert.remote-client.js
		let perse_remote_dev_remoteDev_closeTunnel_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_closeTunnel_parameter_0$schema = () => perse_remote_dev_remoteDev_closeTunnel_parameter_0$schema$value ??= zod.z.object({ "hostId": zod.z.string().readonly() });
		let perse_remote_dev_remoteDev_closeTunnel_result$schema$value;
		const perse_remote_dev_remoteDev_closeTunnel_result$schema = () => perse_remote_dev_remoteDev_closeTunnel_result$schema$value ??= zod.z.object({
			"hostId": zod.z.string().readonly(),
			"closed": zod.z.boolean().readonly()
		});
		let perse_remote_dev_remoteDev_createDirectory_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_createDirectory_parameter_0$schema = () => perse_remote_dev_remoteDev_createDirectory_parameter_0$schema$value ??= zod.z.object({
			"location": zod.z.object({
				"target": zod.z.object({ "hostId": zod.z.string().readonly().describe("`local`, a configured host id, its `fromAlias`, or an ssh-config alias.") }).readonly(),
				"path": zod.z.string().readonly().describe("Canonical path on that host, as the host resolved it."),
				"token": zod.z.string().readonly()
			}).readonly(),
			"name": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_createDirectory_result$schema$value;
		const perse_remote_dev_remoteDev_createDirectory_result$schema = () => perse_remote_dev_remoteDev_createDirectory_result$schema$value ??= zod.z.object({
			"target": zod.z.object({ "hostId": zod.z.string().readonly().describe("`local`, a configured host id, its `fromAlias`, or an ssh-config alias.") }).readonly(),
			"path": zod.z.string().readonly().describe("Canonical path on that host, as the host resolved it."),
			"token": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_describe_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_describe_parameter_0$schema = () => perse_remote_dev_remoteDev_describe_parameter_0$schema$value ??= zod.z.object({ "includeEndpoints": zod.z.boolean().readonly().describe("Include the endpoint list this live instance carries markers for.") });
		let perse_remote_dev_remoteDev_describe_result$schema$value;
		const perse_remote_dev_remoteDev_describe_result$schema = () => perse_remote_dev_remoteDev_describe_result$schema$value ??= zod.z.object({
			"package": zod.z.string().readonly(),
			"face": zod.z.string().readonly(),
			"serviceKey": zod.z.string().readonly(),
			"namespace": zod.z.string().readonly(),
			"endpoints": zod.z.array(zod.z.string()).readonly().describe("Endpoints this live instance actually carries decorator markers for."),
			"revision": zod.z.string().readonly().describe("Content hash of the loaded host artifacts; proves running code identity."),
			"protocolModule": zod.z.string().readonly().describe("Module URL the running process bound for the Remote protocol. A duplicate protocol copy is what silently disables the Remote layer, so the runtime attests which copy it actually loaded instead of leaving it to a doc."),
			"cordisModule": zod.z.string().readonly().describe("Module URL the running process bound for Cordis."),
			"node": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_legacyConfigApply_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_legacyConfigApply_parameter_0$schema = () => perse_remote_dev_remoteDev_legacyConfigApply_parameter_0$schema$value ??= zod.z.object({
			"source": zod.z.union([zod.z.literal("settings.yaml"), zod.z.literal("settings.yaml.imported")]).readonly(),
			"sha256": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_legacyConfigApply_result$schema$value;
		const perse_remote_dev_remoteDev_legacyConfigApply_result$schema = () => perse_remote_dev_remoteDev_legacyConfigApply_result$schema$value ??= zod.z.object({
			"source": zod.z.union([zod.z.literal("settings.yaml"), zod.z.literal("settings.yaml.imported")]).readonly(),
			"importedFields": zod.z.array(zod.z.string()).readonly(),
			"alreadyAppliedFields": zod.z.array(zod.z.string()).readonly()
		});
		let perse_remote_dev_remoteDev_legacyConfigPreview_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_legacyConfigPreview_parameter_0$schema = () => perse_remote_dev_remoteDev_legacyConfigPreview_parameter_0$schema$value ??= zod.z.object({ "source": zod.z.union([zod.z.literal("settings.yaml"), zod.z.literal("settings.yaml.imported")]).readonly().optional() });
		let perse_remote_dev_remoteDev_legacyConfigPreview_result$schema$value;
		const perse_remote_dev_remoteDev_legacyConfigPreview_result$schema = () => perse_remote_dev_remoteDev_legacyConfigPreview_result$schema$value ??= zod.z.object({
			"sources": zod.z.array(zod.z.union([zod.z.literal("settings.yaml"), zod.z.literal("settings.yaml.imported")])).readonly(),
			"source": zod.z.union([zod.z.literal("settings.yaml"), zod.z.literal("settings.yaml.imported")]).readonly().optional(),
			"sourcePath": zod.z.string().readonly().optional(),
			"sha256": zod.z.string().readonly().optional(),
			"importableFields": zod.z.array(zod.z.string()).readonly(),
			"conflictFields": zod.z.array(zod.z.string()).readonly(),
			"unsupportedFields": zod.z.array(zod.z.string()).readonly(),
			"canApply": zod.z.boolean().readonly()
		});
		let perse_remote_dev_remoteDev_listDirectory_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_listDirectory_parameter_0$schema = () => perse_remote_dev_remoteDev_listDirectory_parameter_0$schema$value ??= zod.z.object({
			"target": zod.z.object({ "hostId": zod.z.string().readonly().describe("`local`, a configured host id, its `fromAlias`, or an ssh-config alias.") }).readonly(),
			"path": zod.z.string().readonly().describe("Absolute directory path; empty string means that host's home directory.")
		});
		let perse_remote_dev_remoteDev_listDirectory_result$schema$value;
		const perse_remote_dev_remoteDev_listDirectory_result$schema = () => perse_remote_dev_remoteDev_listDirectory_result$schema$value ??= zod.z.object({
			"target": zod.z.object({ "hostId": zod.z.string().readonly().describe("`local`, a configured host id, its `fromAlias`, or an ssh-config alias.") }).readonly(),
			"host": zod.z.string().readonly().describe("Stable identity of the host that answered."),
			"path": zod.z.string().readonly().describe("Canonical directory path the host resolved (may differ from the request)."),
			"parent": zod.z.string().readonly().optional().describe("Parent directory in the same coordinates; absent at the root."),
			"home": zod.z.string().readonly().describe("Login home directory on that host."),
			"location": zod.z.object({
				"target": zod.z.object({ "hostId": zod.z.string().readonly().describe("`local`, a configured host id, its `fromAlias`, or an ssh-config alias.") }).readonly(),
				"path": zod.z.string().readonly().describe("Canonical path on that host, as the host resolved it."),
				"token": zod.z.string().readonly()
			}).readonly(),
			"entries": zod.z.array(zod.z.object({
				"name": zod.z.string().readonly(),
				"path": zod.z.string().readonly(),
				"hidden": zod.z.boolean().readonly(),
				"location": zod.z.object({
					"target": zod.z.object({ "hostId": zod.z.string().readonly().describe("`local`, a configured host id, its `fromAlias`, or an ssh-config alias.") }).readonly(),
					"path": zod.z.string().readonly().describe("Canonical path on that host, as the host resolved it."),
					"token": zod.z.string().readonly()
				}).readonly().describe("Proof binding `path` to the host that listed it.")
			})).readonly()
		});
		let perse_remote_dev_remoteDev_listTargets_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_listTargets_parameter_0$schema = () => perse_remote_dev_remoteDev_listTargets_parameter_0$schema$value ??= zod.z.object({
			"includeAll": zod.z.boolean().readonly().describe("Include every `~/.ssh/config` alias, not only configured hosts."),
			"probe": zod.z.boolean().readonly().describe("Run an ssh reachability probe for each ssh target."),
			"fresh": zod.z.boolean().readonly().describe("Bypass the probe cache. Ignored unless `probe` is true.")
		});
		let perse_remote_dev_remoteDev_listTargets_result$schema$value;
		const perse_remote_dev_remoteDev_listTargets_result$schema = () => perse_remote_dev_remoteDev_listTargets_result$schema$value ??= zod.z.object({
			"targets": zod.z.array(zod.z.object({
				"id": zod.z.string().readonly().describe("Stable identity used on the wire."),
				"name": zod.z.string().readonly(),
				"kind": zod.z.union([zod.z.literal("local"), zod.z.literal("ssh")]).readonly(),
				"state": zod.z.union([
					zod.z.literal("disconnected"),
					zod.z.literal("connected"),
					zod.z.literal("connecting"),
					zod.z.literal("reconnecting"),
					zod.z.literal("unknown")
				]).readonly(),
				"detail": zod.z.string().readonly().describe("Human-readable address summary."),
				"hostName": zod.z.string().readonly().describe("Resolved ssh `HostName` for ssh targets; empty for `local`."),
				"user": zod.z.string().readonly().describe("Resolved ssh user; empty when ssh itself decides."),
				"port": zod.z.string().readonly().describe("Resolved ssh port; empty for the ssh default or when an alias decides."),
				"proxyJump": zod.z.string().readonly(),
				"aliases": zod.z.array(zod.z.string()).readonly().describe("Every `~/.ssh/config` alias that folds onto the same endpoint."),
				"jump": zod.z.boolean().readonly().describe("This alias is only reachable as another host's ProxyJump."),
				"configured": zod.z.boolean().readonly().describe("This row comes from the user's configured host list, not from ssh config.")
			})).readonly(),
			"configuredOnly": zod.z.boolean().readonly().describe("`true` when only the user's configured hosts are returned.")
		});
		let perse_remote_dev_remoteDev_listTunnels_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_listTunnels_parameter_0$schema = () => perse_remote_dev_remoteDev_listTunnels_parameter_0$schema$value ??= zod.z.object({ "includeDead": zod.z.boolean().readonly().describe("Include tunnels whose ssh process already exited.") });
		let perse_remote_dev_remoteDev_listTunnels_result$schema$value;
		const perse_remote_dev_remoteDev_listTunnels_result$schema = () => perse_remote_dev_remoteDev_listTunnels_result$schema$value ??= zod.z.object({ "tunnels": zod.z.array(zod.z.object({
			"hostId": zod.z.string().readonly(),
			"url": zod.z.string().readonly(),
			"localPort": zod.z.number().readonly(),
			"remotePort": zod.z.string().readonly(),
			"alive": zod.z.boolean().readonly(),
			"openedAt": zod.z.number().readonly(),
			"refreshedAt": zod.z.number().readonly(),
			"authenticated": zod.z.boolean().readonly(),
			"warning": zod.z.string().readonly().optional().describe("Present when the address was handed over without a verified token.")
		})).readonly() });
		let perse_remote_dev_remoteDev_openProject_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_openProject_parameter_0$schema = () => perse_remote_dev_remoteDev_openProject_parameter_0$schema$value ??= zod.z.object({
			"location": zod.z.object({
				"target": zod.z.object({ "hostId": zod.z.string().readonly().describe("`local`, a configured host id, its `fromAlias`, or an ssh-config alias.") }).readonly(),
				"path": zod.z.string().readonly().describe("Canonical path on that host, as the host resolved it."),
				"token": zod.z.string().readonly()
			}).readonly(),
			"remember": zod.z.boolean().readonly().describe("Persist the path on the host record."),
			"requireAuthentication": zod.z.boolean().readonly().describe("Fail with `remote-dev/token-unavailable` instead of degrading.")
		});
		let perse_remote_dev_remoteDev_openProject_result$schema$value;
		const perse_remote_dev_remoteDev_openProject_result$schema = () => perse_remote_dev_remoteDev_openProject_result$schema$value ??= zod.z.object({
			"target": zod.z.object({ "hostId": zod.z.string().readonly().describe("`local`, a configured host id, its `fromAlias`, or an ssh-config alias.") }).readonly(),
			"host": zod.z.string().readonly().describe("Stable identity of the host that answered."),
			"path": zod.z.string().readonly().describe("The path registered/opened on that host."),
			"url": zod.z.string().readonly(),
			"localPort": zod.z.number().readonly(),
			"remotePort": zod.z.string().readonly(),
			"reused": zod.z.boolean().readonly(),
			"authenticated": zod.z.boolean().readonly(),
			"saved": zod.z.boolean().readonly(),
			"warning": zod.z.string().readonly().optional()
		});
		let perse_remote_dev_remoteDev_openTunnel_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_openTunnel_parameter_0$schema = () => perse_remote_dev_remoteDev_openTunnel_parameter_0$schema$value ??= zod.z.object({
			"target": zod.z.object({ "hostId": zod.z.string().readonly().describe("`local`, a configured host id, its `fromAlias`, or an ssh-config alias.") }).readonly(),
			"requireAuthentication": zod.z.boolean().readonly().describe("Fail with `remote-dev/token-unavailable` instead of degrading.")
		});
		let perse_remote_dev_remoteDev_openTunnel_result$schema$value;
		const perse_remote_dev_remoteDev_openTunnel_result$schema = () => perse_remote_dev_remoteDev_openTunnel_result$schema$value ??= zod.z.object({
			"hostId": zod.z.string().readonly(),
			"url": zod.z.string().readonly(),
			"localPort": zod.z.number().readonly(),
			"remotePort": zod.z.string().readonly(),
			"alive": zod.z.boolean().readonly(),
			"openedAt": zod.z.number().readonly(),
			"refreshedAt": zod.z.number().readonly(),
			"authenticated": zod.z.boolean().readonly(),
			"warning": zod.z.string().readonly().optional().describe("Present when the address was handed over without a verified token.")
		});
		let perse_remote_dev_remoteDev_pcCall_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_pcCall_parameter_0$schema = () => perse_remote_dev_remoteDev_pcCall_parameter_0$schema$value ??= zod.z.object({
			"profileId": zod.z.string().readonly(),
			"generation": zod.z.string().readonly(),
			"method": zod.z.string().readonly(),
			"paramsJson": zod.z.string().readonly().describe("JSON-encoded object params, bounded and schema-checked by the bridge.")
		});
		let perse_remote_dev_remoteDev_pcCall_result$schema$value;
		const perse_remote_dev_remoteDev_pcCall_result$schema = () => perse_remote_dev_remoteDev_pcCall_result$schema$value ??= zod.z.object({ "resultJson": zod.z.string().readonly() });
		let perse_remote_dev_remoteDev_pcConnect_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_pcConnect_parameter_0$schema = () => perse_remote_dev_remoteDev_pcConnect_parameter_0$schema$value ??= zod.z.object({ "profileId": zod.z.string().readonly() });
		let perse_remote_dev_remoteDev_pcConnect_result$schema$value;
		const perse_remote_dev_remoteDev_pcConnect_result$schema = () => perse_remote_dev_remoteDev_pcConnect_result$schema$value ??= zod.z.object({
			"profileId": zod.z.string().readonly(),
			"hostId": zod.z.string().readonly(),
			"generation": zod.z.string().readonly(),
			"hostInfoJson": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_pcDisconnect_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_pcDisconnect_parameter_0$schema = () => perse_remote_dev_remoteDev_pcDisconnect_parameter_0$schema$value ??= zod.z.object({ "profileId": zod.z.string().readonly() });
		let perse_remote_dev_remoteDev_pcDisconnect_result$schema$value;
		const perse_remote_dev_remoteDev_pcDisconnect_result$schema = () => perse_remote_dev_remoteDev_pcDisconnect_result$schema$value ??= zod.z.object({
			"profileId": zod.z.string().readonly(),
			"disconnected": zod.z.literal(true).readonly()
		});
		let perse_remote_dev_remoteDev_pcForget_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_pcForget_parameter_0$schema = () => perse_remote_dev_remoteDev_pcForget_parameter_0$schema$value ??= zod.z.object({ "profileId": zod.z.string().readonly() });
		let perse_remote_dev_remoteDev_pcForget_result$schema$value;
		const perse_remote_dev_remoteDev_pcForget_result$schema = () => perse_remote_dev_remoteDev_pcForget_result$schema$value ??= zod.z.object({
			"profileId": zod.z.string().readonly(),
			"forgotten": zod.z.literal(true).readonly()
		});
		let perse_remote_dev_remoteDev_pcPairConfirm_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_pcPairConfirm_parameter_0$schema = () => perse_remote_dev_remoteDev_pcPairConfirm_parameter_0$schema$value ??= zod.z.object({
			"confirmationId": zod.z.string().readonly(),
			"deviceName": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_pcPairConfirm_result$schema$value;
		const perse_remote_dev_remoteDev_pcPairConfirm_result$schema = () => perse_remote_dev_remoteDev_pcPairConfirm_result$schema$value ??= zod.z.object({
			"profileId": zod.z.string().readonly(),
			"hostId": zod.z.string().readonly(),
			"generation": zod.z.string().readonly(),
			"hostInfoJson": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_pcPairPreview_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_pcPairPreview_parameter_0$schema = () => perse_remote_dev_remoteDev_pcPairPreview_parameter_0$schema$value ??= zod.z.object({ "link": zod.z.string().readonly() });
		let perse_remote_dev_remoteDev_pcPairPreview_result$schema$value;
		const perse_remote_dev_remoteDev_pcPairPreview_result$schema = () => perse_remote_dev_remoteDev_pcPairPreview_result$schema$value ??= zod.z.object({
			"confirmationId": zod.z.string().readonly(),
			"hostId": zod.z.string().readonly(),
			"hostName": zod.z.string().readonly(),
			"endpoint": zod.z.string().readonly(),
			"networkMode": zod.z.union([
				zod.z.literal("https"),
				zod.z.literal("tailnet"),
				zod.z.literal("local")
			]).readonly(),
			"expiresAt": zod.z.string().readonly(),
			"accessSummary": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_pcProfiles_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_pcProfiles_parameter_0$schema = () => perse_remote_dev_remoteDev_pcProfiles_parameter_0$schema$value ??= zod.z.object({});
		let perse_remote_dev_remoteDev_pcProfiles_result$schema$value;
		const perse_remote_dev_remoteDev_pcProfiles_result$schema = () => perse_remote_dev_remoteDev_pcProfiles_result$schema$value ??= zod.z.object({ "profiles": zod.z.array(zod.z.object({
			"profileId": zod.z.string().readonly(),
			"endpoint": zod.z.string().readonly(),
			"networkMode": zod.z.union([
				zod.z.literal("https"),
				zod.z.literal("tailnet"),
				zod.z.literal("local")
			]).readonly(),
			"hostId": zod.z.string().readonly(),
			"hostName": zod.z.string().readonly(),
			"deviceId": zod.z.string().readonly(),
			"deviceName": zod.z.string().readonly(),
			"status": zod.z.union([
				zod.z.literal("disconnected"),
				zod.z.literal("connected"),
				zod.z.literal("offline"),
				zod.z.literal("revoked")
			]).readonly(),
			"protocolVersion": zod.z.string().readonly().optional(),
			"verifiedAt": zod.z.string().readonly().optional()
		})).readonly() });
		let perse_remote_dev_remoteDev_pcRevoke_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_pcRevoke_parameter_0$schema = () => perse_remote_dev_remoteDev_pcRevoke_parameter_0$schema$value ??= zod.z.object({
			"profileId": zod.z.string().readonly(),
			"generation": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_pcRevoke_result$schema$value;
		const perse_remote_dev_remoteDev_pcRevoke_result$schema = () => perse_remote_dev_remoteDev_pcRevoke_result$schema$value ??= zod.z.object({
			"profileId": zod.z.string().readonly(),
			"revoked": zod.z.literal(true).readonly()
		});
		let perse_remote_dev_remoteDev_readConfiguration_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_readConfiguration_parameter_0$schema = () => perse_remote_dev_remoteDev_readConfiguration_parameter_0$schema$value ??= zod.z.object({ "includeCandidates": zod.z.boolean().readonly().describe("Include the `~/.ssh/config` import candidates.") });
		let perse_remote_dev_remoteDev_readConfiguration_result$schema$value;
		const perse_remote_dev_remoteDev_readConfiguration_result$schema = () => perse_remote_dev_remoteDev_readConfiguration_result$schema$value ??= zod.z.object({
			"hosts": zod.z.array(zod.z.object({
				"id": zod.z.string().readonly(),
				"name": zod.z.string().readonly(),
				"address": zod.z.string().readonly().describe("Network address; empty when an ssh alias is used."),
				"port": zod.z.string().readonly(),
				"username": zod.z.string().readonly(),
				"auth": zod.z.string().readonly().describe("`key` | `password` | `agent`; validated on write."),
				"keyPath": zod.z.string().readonly().describe("Private key path for direct connections; empty means the ssh default/agent."),
				"passwordRef": zod.z.string().readonly().describe("Credential reference name; plaintext passwords are never stored."),
				"fromAlias": zod.z.string().readonly().describe("`~/.ssh/config` alias this record was imported from, when any."),
				"projectPath": zod.z.string().readonly().describe("Last project path used on this host."),
				"remotePort": zod.z.string().readonly().describe("Remote DSH listen port; `3080` when unset."),
				"projects": zod.z.array(zod.z.string()).readonly()
			})).readonly(),
			"migrated": zod.z.boolean().readonly().describe("The legacy `targets` array was folded into `hosts` for this read."),
			"enginePath": zod.z.string().readonly(),
			"resolved": zod.z.object({
				"host": zod.z.string().readonly().describe("ssh target the host would use: alias first, else `user@address`."),
				"hostId": zod.z.string().readonly().describe("Stable identity of the same target."),
				"projectPath": zod.z.string().readonly(),
				"mDir": zod.z.string().readonly().describe("Stored batch directory (M) for the review loop; empty when unset."),
				"hub": zod.z.string().readonly(),
				"verifyCmd": zod.z.string().readonly()
			}).readonly(),
			"configured": zod.z.boolean().readonly(),
			"missing": zod.z.array(zod.z.string()).readonly(),
			"hint": zod.z.string().readonly(),
			"candidates": zod.z.array(zod.z.object({
				"id": zod.z.string().readonly().describe("Stable identity used on the wire."),
				"name": zod.z.string().readonly(),
				"kind": zod.z.union([zod.z.literal("local"), zod.z.literal("ssh")]).readonly(),
				"state": zod.z.union([
					zod.z.literal("disconnected"),
					zod.z.literal("connected"),
					zod.z.literal("connecting"),
					zod.z.literal("reconnecting"),
					zod.z.literal("unknown")
				]).readonly(),
				"detail": zod.z.string().readonly().describe("Human-readable address summary."),
				"hostName": zod.z.string().readonly().describe("Resolved ssh `HostName` for ssh targets; empty for `local`."),
				"user": zod.z.string().readonly().describe("Resolved ssh user; empty when ssh itself decides."),
				"port": zod.z.string().readonly().describe("Resolved ssh port; empty for the ssh default or when an alias decides."),
				"proxyJump": zod.z.string().readonly(),
				"aliases": zod.z.array(zod.z.string()).readonly().describe("Every `~/.ssh/config` alias that folds onto the same endpoint."),
				"jump": zod.z.boolean().readonly().describe("This alias is only reachable as another host's ProxyJump."),
				"configured": zod.z.boolean().readonly().describe("This row comes from the user's configured host list, not from ssh config.")
			})).readonly().describe("`~/.ssh/config` aliases offered as import sources.")
		});
		let perse_remote_dev_remoteDev_reviewApply_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_reviewApply_parameter_0$schema = () => perse_remote_dev_remoteDev_reviewApply_parameter_0$schema$value ??= zod.z.object({
			"target": zod.z.object({
				"hostId": zod.z.string().readonly(),
				"projectPath": zod.z.string().readonly().describe("W: the project working tree the batch is applied to."),
				"mDir": zod.z.string().readonly().describe("M: the source tree the batch was produced from."),
				"hub": zod.z.string().readonly().describe("The hub repository holding the `rd-base` baseline."),
				"verifyCmd": zod.z.string().readonly().describe("Local verification command; empty means no verification step."),
				"token": zod.z.string().readonly().optional().describe("Host-issued proof over every field above; required by mutating verbs.")
			}).readonly(),
			"files": zod.z.array(zod.z.string()).readonly(),
			"base": zod.z.string().readonly().describe("Explicit baseline; empty string asks the host to resolve `rd-base`."),
			"verify": zod.z.boolean().readonly().describe("Run the target's `verifyCmd` between apply and baseline push.")
		});
		let perse_remote_dev_remoteDev_reviewApply_result$schema$value;
		const perse_remote_dev_remoteDev_reviewApply_result$schema = () => perse_remote_dev_remoteDev_reviewApply_result$schema$value ??= zod.z.object({
			"ok": zod.z.boolean().readonly(),
			"failedAt": zod.z.string().readonly().optional(),
			"steps": zod.z.array(zod.z.object({
				"step": zod.z.string().readonly(),
				"code": zod.z.number().readonly(),
				"output": zod.z.string().readonly()
			})).readonly(),
			"base": zod.z.string().readonly(),
			"head": zod.z.string().readonly(),
			"files": zod.z.array(zod.z.string()).readonly(),
			"verified": zod.z.boolean().readonly(),
			"note": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_reviewBatch_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_reviewBatch_parameter_0$schema = () => perse_remote_dev_remoteDev_reviewBatch_parameter_0$schema$value ??= zod.z.object({
			"target": zod.z.object({
				"hostId": zod.z.string().readonly(),
				"projectPath": zod.z.string().readonly().describe("W: the project working tree the batch is applied to."),
				"mDir": zod.z.string().readonly().describe("M: the source tree the batch was produced from."),
				"hub": zod.z.string().readonly().describe("The hub repository holding the `rd-base` baseline."),
				"verifyCmd": zod.z.string().readonly().describe("Local verification command; empty means no verification step."),
				"token": zod.z.string().readonly().optional().describe("Host-issued proof over every field above; required by mutating verbs.")
			}).readonly(),
			"base": zod.z.string().readonly().describe("Explicit baseline; empty string asks the host to resolve `rd-base`.")
		});
		let perse_remote_dev_remoteDev_reviewBatch_result$schema$value;
		const perse_remote_dev_remoteDev_reviewBatch_result$schema = () => perse_remote_dev_remoteDev_reviewBatch_result$schema$value ??= zod.z.object({
			"target": zod.z.object({
				"hostId": zod.z.string().readonly(),
				"projectPath": zod.z.string().readonly().describe("W: the project working tree the batch is applied to."),
				"mDir": zod.z.string().readonly().describe("M: the source tree the batch was produced from."),
				"hub": zod.z.string().readonly().describe("The hub repository holding the `rd-base` baseline."),
				"verifyCmd": zod.z.string().readonly().describe("Local verification command; empty means no verification step."),
				"token": zod.z.string().readonly().optional().describe("Host-issued proof over every field above; required by mutating verbs.")
			}).readonly(),
			"engine": zod.z.string().readonly(),
			"base": zod.z.string().readonly(),
			"head": zod.z.string().readonly(),
			"files": zod.z.array(zod.z.object({
				"path": zod.z.string().readonly(),
				"add": zod.z.number().readonly().optional().describe("Added lines; absent for a deletion."),
				"del": zod.z.number().readonly().optional().describe("Deleted lines; absent for an addition."),
				"status": zod.z.union([
					zod.z.literal("A"),
					zod.z.literal("M"),
					zod.z.literal("D")
				]).readonly()
			})).readonly(),
			"diff": zod.z.string().readonly(),
			"empty": zod.z.boolean().readonly()
		});
		let perse_remote_dev_remoteDev_reviewReject_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_reviewReject_parameter_0$schema = () => perse_remote_dev_remoteDev_reviewReject_parameter_0$schema$value ??= zod.z.object({
			"target": zod.z.object({
				"hostId": zod.z.string().readonly(),
				"projectPath": zod.z.string().readonly().describe("W: the project working tree the batch is applied to."),
				"mDir": zod.z.string().readonly().describe("M: the source tree the batch was produced from."),
				"hub": zod.z.string().readonly().describe("The hub repository holding the `rd-base` baseline."),
				"verifyCmd": zod.z.string().readonly().describe("Local verification command; empty means no verification step."),
				"token": zod.z.string().readonly().optional().describe("Host-issued proof over every field above; required by mutating verbs.")
			}).readonly(),
			"files": zod.z.array(zod.z.string()).readonly(),
			"base": zod.z.string().readonly(),
			"comment": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_reviewReject_result$schema$value;
		const perse_remote_dev_remoteDev_reviewReject_result$schema = () => perse_remote_dev_remoteDev_reviewReject_result$schema$value ??= zod.z.object({
			"ts": zod.z.string().readonly(),
			"kind": zod.z.string().readonly(),
			"host": zod.z.string().readonly(),
			"base": zod.z.string().readonly(),
			"files": zod.z.array(zod.z.string()).readonly(),
			"comment": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_reviewRollback_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_reviewRollback_parameter_0$schema = () => perse_remote_dev_remoteDev_reviewRollback_parameter_0$schema$value ??= zod.z.object({
			"target": zod.z.object({
				"hostId": zod.z.string().readonly(),
				"projectPath": zod.z.string().readonly().describe("W: the project working tree the batch is applied to."),
				"mDir": zod.z.string().readonly().describe("M: the source tree the batch was produced from."),
				"hub": zod.z.string().readonly().describe("The hub repository holding the `rd-base` baseline."),
				"verifyCmd": zod.z.string().readonly().describe("Local verification command; empty means no verification step."),
				"token": zod.z.string().readonly().optional().describe("Host-issued proof over every field above; required by mutating verbs.")
			}).readonly(),
			"ref": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_reviewRollback_result$schema$value;
		const perse_remote_dev_remoteDev_reviewRollback_result$schema = () => perse_remote_dev_remoteDev_reviewRollback_result$schema$value ??= zod.z.object({
			"ok": zod.z.boolean().readonly(),
			"code": zod.z.number().readonly(),
			"ref": zod.z.string().readonly(),
			"output": zod.z.string().readonly(),
			"note": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_reviewStatus_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_reviewStatus_parameter_0$schema = () => perse_remote_dev_remoteDev_reviewStatus_parameter_0$schema$value ??= zod.z.object({ "target": zod.z.object({
			"hostId": zod.z.string().readonly(),
			"projectPath": zod.z.string().readonly().describe("W: the project working tree the batch is applied to."),
			"mDir": zod.z.string().readonly().describe("M: the source tree the batch was produced from."),
			"hub": zod.z.string().readonly().describe("The hub repository holding the `rd-base` baseline."),
			"verifyCmd": zod.z.string().readonly().describe("Local verification command; empty means no verification step."),
			"token": zod.z.string().readonly().optional().describe("Host-issued proof over every field above; required by mutating verbs.")
		}).readonly() });
		let perse_remote_dev_remoteDev_reviewStatus_result$schema$value;
		const perse_remote_dev_remoteDev_reviewStatus_result$schema = () => perse_remote_dev_remoteDev_reviewStatus_result$schema$value ??= zod.z.object({
			"target": zod.z.object({
				"hostId": zod.z.string().readonly(),
				"projectPath": zod.z.string().readonly().describe("W: the project working tree the batch is applied to."),
				"mDir": zod.z.string().readonly().describe("M: the source tree the batch was produced from."),
				"hub": zod.z.string().readonly().describe("The hub repository holding the `rd-base` baseline."),
				"verifyCmd": zod.z.string().readonly().describe("Local verification command; empty means no verification step."),
				"token": zod.z.string().readonly().optional().describe("Host-issued proof over every field above; required by mutating verbs.")
			}).readonly(),
			"base": zod.z.string().readonly().optional(),
			"head": zod.z.string().readonly().optional(),
			"dirty": zod.z.number().readonly(),
			"missing": zod.z.boolean().readonly()
		});
		let perse_remote_dev_remoteDev_updateConfiguration_parameter_0$schema$value;
		const perse_remote_dev_remoteDev_updateConfiguration_parameter_0$schema = () => perse_remote_dev_remoteDev_updateConfiguration_parameter_0$schema$value ??= zod.z.object({
			"hosts": zod.z.array(zod.z.object({
				"id": zod.z.string().readonly(),
				"name": zod.z.string().readonly(),
				"address": zod.z.string().readonly().describe("Network address; empty when an ssh alias is used."),
				"port": zod.z.string().readonly(),
				"username": zod.z.string().readonly(),
				"auth": zod.z.string().readonly().describe("`key` | `password` | `agent`; validated on write."),
				"keyPath": zod.z.string().readonly().describe("Private key path for direct connections; empty means the ssh default/agent."),
				"passwordRef": zod.z.string().readonly().describe("Credential reference name; plaintext passwords are never stored."),
				"fromAlias": zod.z.string().readonly().describe("`~/.ssh/config` alias this record was imported from, when any."),
				"projectPath": zod.z.string().readonly().describe("Last project path used on this host."),
				"remotePort": zod.z.string().readonly().describe("Remote DSH listen port; `3080` when unset."),
				"projects": zod.z.array(zod.z.string()).readonly()
			})).readonly(),
			"projectPath": zod.z.string().readonly().describe("Empty string leaves the stored project path untouched."),
			"mDir": zod.z.string().readonly().describe("Empty string leaves the stored batch directory (M) untouched."),
			"hub": zod.z.string().readonly().describe("Empty string leaves the stored hub untouched."),
			"enginePath": zod.z.string().readonly().describe("Empty string leaves the stored engine path untouched.")
		});
		let perse_remote_dev_remoteDev_updateConfiguration_result$schema$value;
		const perse_remote_dev_remoteDev_updateConfiguration_result$schema = () => perse_remote_dev_remoteDev_updateConfiguration_result$schema$value ??= zod.z.object({
			"configured": zod.z.boolean().readonly(),
			"missing": zod.z.array(zod.z.string()).readonly()
		});
		let perse_remote_dev_remoteDev_closeTunnel_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_closeTunnel_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_closeTunnel_parameter_0_strict$schema$value ??= zod.z.strictObject({ "hostId": zod.z.string().readonly() });
		let perse_remote_dev_remoteDev_createDirectory_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_createDirectory_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_createDirectory_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"location": zod.z.strictObject({
				"target": zod.z.strictObject({ "hostId": zod.z.string().readonly().describe("`local`, a configured host id, its `fromAlias`, or an ssh-config alias.") }).readonly(),
				"path": zod.z.string().readonly().describe("Canonical path on that host, as the host resolved it."),
				"token": zod.z.string().readonly()
			}).readonly(),
			"name": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_describe_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_describe_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_describe_parameter_0_strict$schema$value ??= zod.z.strictObject({ "includeEndpoints": zod.z.boolean().readonly().describe("Include the endpoint list this live instance carries markers for.") });
		let perse_remote_dev_remoteDev_legacyConfigApply_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_legacyConfigApply_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_legacyConfigApply_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"source": zod.z.union([zod.z.literal("settings.yaml"), zod.z.literal("settings.yaml.imported")]).readonly(),
			"sha256": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_legacyConfigPreview_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_legacyConfigPreview_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_legacyConfigPreview_parameter_0_strict$schema$value ??= zod.z.strictObject({ "source": zod.z.union([zod.z.literal("settings.yaml"), zod.z.literal("settings.yaml.imported")]).readonly().optional() });
		let perse_remote_dev_remoteDev_listDirectory_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_listDirectory_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_listDirectory_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"target": zod.z.strictObject({ "hostId": zod.z.string().readonly().describe("`local`, a configured host id, its `fromAlias`, or an ssh-config alias.") }).readonly(),
			"path": zod.z.string().readonly().describe("Absolute directory path; empty string means that host's home directory.")
		});
		let perse_remote_dev_remoteDev_listTargets_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_listTargets_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_listTargets_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"includeAll": zod.z.boolean().readonly().describe("Include every `~/.ssh/config` alias, not only configured hosts."),
			"probe": zod.z.boolean().readonly().describe("Run an ssh reachability probe for each ssh target."),
			"fresh": zod.z.boolean().readonly().describe("Bypass the probe cache. Ignored unless `probe` is true.")
		});
		let perse_remote_dev_remoteDev_listTunnels_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_listTunnels_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_listTunnels_parameter_0_strict$schema$value ??= zod.z.strictObject({ "includeDead": zod.z.boolean().readonly().describe("Include tunnels whose ssh process already exited.") });
		let perse_remote_dev_remoteDev_openProject_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_openProject_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_openProject_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"location": zod.z.strictObject({
				"target": zod.z.strictObject({ "hostId": zod.z.string().readonly().describe("`local`, a configured host id, its `fromAlias`, or an ssh-config alias.") }).readonly(),
				"path": zod.z.string().readonly().describe("Canonical path on that host, as the host resolved it."),
				"token": zod.z.string().readonly()
			}).readonly(),
			"remember": zod.z.boolean().readonly().describe("Persist the path on the host record."),
			"requireAuthentication": zod.z.boolean().readonly().describe("Fail with `remote-dev/token-unavailable` instead of degrading.")
		});
		let perse_remote_dev_remoteDev_openTunnel_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_openTunnel_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_openTunnel_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"target": zod.z.strictObject({ "hostId": zod.z.string().readonly().describe("`local`, a configured host id, its `fromAlias`, or an ssh-config alias.") }).readonly(),
			"requireAuthentication": zod.z.boolean().readonly().describe("Fail with `remote-dev/token-unavailable` instead of degrading.")
		});
		let perse_remote_dev_remoteDev_pcCall_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_pcCall_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_pcCall_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"profileId": zod.z.string().readonly(),
			"generation": zod.z.string().readonly(),
			"method": zod.z.string().readonly(),
			"paramsJson": zod.z.string().readonly().describe("JSON-encoded object params, bounded and schema-checked by the bridge.")
		});
		let perse_remote_dev_remoteDev_pcConnect_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_pcConnect_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_pcConnect_parameter_0_strict$schema$value ??= zod.z.strictObject({ "profileId": zod.z.string().readonly() });
		let perse_remote_dev_remoteDev_pcDisconnect_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_pcDisconnect_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_pcDisconnect_parameter_0_strict$schema$value ??= zod.z.strictObject({ "profileId": zod.z.string().readonly() });
		let perse_remote_dev_remoteDev_pcForget_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_pcForget_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_pcForget_parameter_0_strict$schema$value ??= zod.z.strictObject({ "profileId": zod.z.string().readonly() });
		let perse_remote_dev_remoteDev_pcPairConfirm_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_pcPairConfirm_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_pcPairConfirm_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"confirmationId": zod.z.string().readonly(),
			"deviceName": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_pcPairPreview_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_pcPairPreview_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_pcPairPreview_parameter_0_strict$schema$value ??= zod.z.strictObject({ "link": zod.z.string().readonly() });
		let perse_remote_dev_remoteDev_pcProfiles_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_pcProfiles_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_pcProfiles_parameter_0_strict$schema$value ??= zod.z.strictObject({});
		let perse_remote_dev_remoteDev_pcRevoke_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_pcRevoke_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_pcRevoke_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"profileId": zod.z.string().readonly(),
			"generation": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_readConfiguration_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_readConfiguration_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_readConfiguration_parameter_0_strict$schema$value ??= zod.z.strictObject({ "includeCandidates": zod.z.boolean().readonly().describe("Include the `~/.ssh/config` import candidates.") });
		let perse_remote_dev_remoteDev_reviewApply_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_reviewApply_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_reviewApply_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"target": zod.z.strictObject({
				"hostId": zod.z.string().readonly(),
				"projectPath": zod.z.string().readonly().describe("W: the project working tree the batch is applied to."),
				"mDir": zod.z.string().readonly().describe("M: the source tree the batch was produced from."),
				"hub": zod.z.string().readonly().describe("The hub repository holding the `rd-base` baseline."),
				"verifyCmd": zod.z.string().readonly().describe("Local verification command; empty means no verification step."),
				"token": zod.z.string().readonly().optional().describe("Host-issued proof over every field above; required by mutating verbs.")
			}).readonly(),
			"files": zod.z.array(zod.z.string()).readonly(),
			"base": zod.z.string().readonly().describe("Explicit baseline; empty string asks the host to resolve `rd-base`."),
			"verify": zod.z.boolean().readonly().describe("Run the target's `verifyCmd` between apply and baseline push.")
		});
		let perse_remote_dev_remoteDev_reviewBatch_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_reviewBatch_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_reviewBatch_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"target": zod.z.strictObject({
				"hostId": zod.z.string().readonly(),
				"projectPath": zod.z.string().readonly().describe("W: the project working tree the batch is applied to."),
				"mDir": zod.z.string().readonly().describe("M: the source tree the batch was produced from."),
				"hub": zod.z.string().readonly().describe("The hub repository holding the `rd-base` baseline."),
				"verifyCmd": zod.z.string().readonly().describe("Local verification command; empty means no verification step."),
				"token": zod.z.string().readonly().optional().describe("Host-issued proof over every field above; required by mutating verbs.")
			}).readonly(),
			"base": zod.z.string().readonly().describe("Explicit baseline; empty string asks the host to resolve `rd-base`.")
		});
		let perse_remote_dev_remoteDev_reviewReject_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_reviewReject_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_reviewReject_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"target": zod.z.strictObject({
				"hostId": zod.z.string().readonly(),
				"projectPath": zod.z.string().readonly().describe("W: the project working tree the batch is applied to."),
				"mDir": zod.z.string().readonly().describe("M: the source tree the batch was produced from."),
				"hub": zod.z.string().readonly().describe("The hub repository holding the `rd-base` baseline."),
				"verifyCmd": zod.z.string().readonly().describe("Local verification command; empty means no verification step."),
				"token": zod.z.string().readonly().optional().describe("Host-issued proof over every field above; required by mutating verbs.")
			}).readonly(),
			"files": zod.z.array(zod.z.string()).readonly(),
			"base": zod.z.string().readonly(),
			"comment": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_reviewRollback_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_reviewRollback_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_reviewRollback_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"target": zod.z.strictObject({
				"hostId": zod.z.string().readonly(),
				"projectPath": zod.z.string().readonly().describe("W: the project working tree the batch is applied to."),
				"mDir": zod.z.string().readonly().describe("M: the source tree the batch was produced from."),
				"hub": zod.z.string().readonly().describe("The hub repository holding the `rd-base` baseline."),
				"verifyCmd": zod.z.string().readonly().describe("Local verification command; empty means no verification step."),
				"token": zod.z.string().readonly().optional().describe("Host-issued proof over every field above; required by mutating verbs.")
			}).readonly(),
			"ref": zod.z.string().readonly()
		});
		let perse_remote_dev_remoteDev_reviewStatus_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_reviewStatus_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_reviewStatus_parameter_0_strict$schema$value ??= zod.z.strictObject({ "target": zod.z.strictObject({
			"hostId": zod.z.string().readonly(),
			"projectPath": zod.z.string().readonly().describe("W: the project working tree the batch is applied to."),
			"mDir": zod.z.string().readonly().describe("M: the source tree the batch was produced from."),
			"hub": zod.z.string().readonly().describe("The hub repository holding the `rd-base` baseline."),
			"verifyCmd": zod.z.string().readonly().describe("Local verification command; empty means no verification step."),
			"token": zod.z.string().readonly().optional().describe("Host-issued proof over every field above; required by mutating verbs.")
		}).readonly() });
		let perse_remote_dev_remoteDev_updateConfiguration_parameter_0_strict$schema$value;
		const perse_remote_dev_remoteDev_updateConfiguration_parameter_0_strict$schema = () => perse_remote_dev_remoteDev_updateConfiguration_parameter_0_strict$schema$value ??= zod.z.strictObject({
			"hosts": zod.z.array(zod.z.strictObject({
				"id": zod.z.string().readonly(),
				"name": zod.z.string().readonly(),
				"address": zod.z.string().readonly().describe("Network address; empty when an ssh alias is used."),
				"port": zod.z.string().readonly(),
				"username": zod.z.string().readonly(),
				"auth": zod.z.string().readonly().describe("`key` | `password` | `agent`; validated on write."),
				"keyPath": zod.z.string().readonly().describe("Private key path for direct connections; empty means the ssh default/agent."),
				"passwordRef": zod.z.string().readonly().describe("Credential reference name; plaintext passwords are never stored."),
				"fromAlias": zod.z.string().readonly().describe("`~/.ssh/config` alias this record was imported from, when any."),
				"projectPath": zod.z.string().readonly().describe("Last project path used on this host."),
				"remotePort": zod.z.string().readonly().describe("Remote DSH listen port; `3080` when unset."),
				"projects": zod.z.array(zod.z.string()).readonly()
			})).readonly(),
			"projectPath": zod.z.string().readonly().describe("Empty string leaves the stored project path untouched."),
			"mDir": zod.z.string().readonly().describe("Empty string leaves the stored batch directory (M) untouched."),
			"hub": zod.z.string().readonly().describe("Empty string leaves the stored hub untouched."),
			"enginePath": zod.z.string().readonly().describe("Empty string leaves the stored engine path untouched.")
		});
		const TYPERT_REMOTE = createTypertRemoteInfo({
			package: "perse-remote-dev",
			methods: {
				"remoteDev/closeTunnel": {
					service: "remoteDev",
					description: "Close every tunnel to one host. Replaces `DELETE /tunnel`.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "host identity.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteCloseTunnelRequest",
							create: perse_remote_dev_remoteDev_closeTunnel_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "hostId": { "type": "string" } },
								"required": ["hostId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteCloseTunnelRequest",
							create: perse_remote_dev_remoteDev_closeTunnel_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "hostId": { "type": "string" } },
								"required": ["hostId"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteTunnelClosedValue",
						create: perse_remote_dev_remoteDev_closeTunnel_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"hostId": { "type": "string" },
								"closed": { "type": "boolean" }
							},
							"required": ["hostId", "closed"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 586,
						"column": 3
					}
				},
				"remoteDev/createDirectory": {
					service: "remoteDev",
					description: "Create one directory below a host-observed location. Replaces `POST /mkdir`. Remote creation is served, not approximated away: the verb answers for both host kinds, and an unsupported host kind is refused at the host rather than hidden in the UI.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "proof-bearing parent location plus the new segment.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteMkdirRequest",
							create: perse_remote_dev_remoteDev_createDirectory_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"location": {
										"type": "object",
										"properties": {
											"target": {
												"type": "object",
												"properties": { "hostId": {
													"type": "string",
													"description": "`local`, a configured host id, its `fromAlias`, or an ssh-config alias."
												} },
												"required": ["hostId"],
												"additionalProperties": true
											},
											"path": {
												"type": "string",
												"description": "Canonical path on that host, as the host resolved it."
											},
											"token": { "type": "string" }
										},
										"required": [
											"target",
											"path",
											"token"
										],
										"additionalProperties": true
									},
									"name": { "type": "string" }
								},
								"required": ["location", "name"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteMkdirRequest",
							create: perse_remote_dev_remoteDev_createDirectory_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"location": {
										"type": "object",
										"properties": {
											"target": {
												"type": "object",
												"properties": { "hostId": {
													"type": "string",
													"description": "`local`, a configured host id, its `fromAlias`, or an ssh-config alias."
												} },
												"required": ["hostId"],
												"additionalProperties": false
											},
											"path": {
												"type": "string",
												"description": "Canonical path on that host, as the host resolved it."
											},
											"token": { "type": "string" }
										},
										"required": [
											"target",
											"path",
											"token"
										],
										"additionalProperties": false
									},
									"name": { "type": "string" }
								},
								"required": ["location", "name"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteWorkspaceLocation",
						create: perse_remote_dev_remoteDev_createDirectory_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"target": {
									"type": "object",
									"properties": { "hostId": {
										"type": "string",
										"description": "`local`, a configured host id, its `fromAlias`, or an ssh-config alias."
									} },
									"required": ["hostId"],
									"additionalProperties": true
								},
								"path": {
									"type": "string",
									"description": "Canonical path on that host, as the host resolved it."
								},
								"token": { "type": "string" }
							},
							"required": [
								"target",
								"path",
								"token"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 519,
						"column": 9
					}
				},
				"remoteDev/describe": {
					service: "remoteDev",
					description: "Runtime self-attestation: which endpoints this live instance carries, and a content hash of the loaded artifacts. A deployment can drift — source deleted from disk while the process keeps serving the already-loaded artifacts — with no way to tell; this is the observable that makes that drift detectable.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "whether to include the endpoint list.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteDescribeRequest",
							create: perse_remote_dev_remoteDev_describe_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "includeEndpoints": {
									"type": "boolean",
									"description": "Include the endpoint list this live instance carries markers for."
								} },
								"required": ["includeEndpoints"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteDescribeRequest",
							create: perse_remote_dev_remoteDev_describe_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "includeEndpoints": {
									"type": "boolean",
									"description": "Include the endpoint list this live instance carries markers for."
								} },
								"required": ["includeEndpoints"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteServiceDescription",
						create: perse_remote_dev_remoteDev_describe_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"package": { "type": "string" },
								"face": { "type": "string" },
								"serviceKey": { "type": "string" },
								"namespace": { "type": "string" },
								"endpoints": {
									"type": "array",
									"items": { "type": "string" },
									"description": "Endpoints this live instance actually carries decorator markers for."
								},
								"revision": {
									"type": "string",
									"description": "Content hash of the loaded host artifacts; proves running code identity."
								},
								"protocolModule": {
									"type": "string",
									"description": "Module URL the running process bound for the Remote protocol. A duplicate protocol copy is what silently disables the Remote layer, so the runtime attests which copy it actually loaded instead of leaving it to a doc."
								},
								"cordisModule": {
									"type": "string",
									"description": "Module URL the running process bound for Cordis."
								},
								"node": { "type": "string" }
							},
							"required": [
								"package",
								"face",
								"serviceKey",
								"namespace",
								"endpoints",
								"revision",
								"protocolModule",
								"cordisModule",
								"node"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 803,
						"column": 9
					}
				},
				"remoteDev/legacyConfigApply": {
					service: "remoteDev",
					description: "Apply the exact bytes reviewed by legacyConfigPreview into the active native profile.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#LegacyConfigApplyRequest",
							create: perse_remote_dev_remoteDev_legacyConfigApply_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"source": {
										"type": "string",
										"enum": ["settings.yaml", "settings.yaml.imported"]
									},
									"sha256": { "type": "string" }
								},
								"required": ["source", "sha256"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#LegacyConfigApplyRequest",
							create: perse_remote_dev_remoteDev_legacyConfigApply_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"source": {
										"type": "string",
										"enum": ["settings.yaml", "settings.yaml.imported"]
									},
									"sha256": { "type": "string" }
								},
								"required": ["source", "sha256"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#LegacyConfigApplyValue",
						create: perse_remote_dev_remoteDev_legacyConfigApply_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"source": {
									"type": "string",
									"enum": ["settings.yaml", "settings.yaml.imported"]
								},
								"importedFields": {
									"type": "array",
									"items": { "type": "string" }
								},
								"alreadyAppliedFields": {
									"type": "array",
									"items": { "type": "string" }
								}
							},
							"required": [
								"source",
								"importedFields",
								"alreadyAppliedFields"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 444,
						"column": 9
					}
				},
				"remoteDev/legacyConfigPreview": {
					service: "remoteDev",
					description: "Inspect a legacy Settings importer file without returning any stored values.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#LegacyConfigPreviewRequest",
							create: perse_remote_dev_remoteDev_legacyConfigPreview_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "source": {
									"type": "string",
									"enum": ["settings.yaml", "settings.yaml.imported"]
								} },
								"required": [],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#LegacyConfigPreviewRequest",
							create: perse_remote_dev_remoteDev_legacyConfigPreview_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "source": {
									"type": "string",
									"enum": ["settings.yaml", "settings.yaml.imported"]
								} },
								"required": [],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#LegacyConfigPreviewValue",
						create: perse_remote_dev_remoteDev_legacyConfigPreview_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"sources": {
									"type": "array",
									"items": {
										"type": "string",
										"enum": ["settings.yaml", "settings.yaml.imported"]
									}
								},
								"source": {
									"type": "string",
									"enum": ["settings.yaml", "settings.yaml.imported"]
								},
								"sourcePath": { "type": "string" },
								"sha256": { "type": "string" },
								"importableFields": {
									"type": "array",
									"items": { "type": "string" }
								},
								"conflictFields": {
									"type": "array",
									"items": { "type": "string" }
								},
								"unsupportedFields": {
									"type": "array",
									"items": { "type": "string" }
								},
								"canApply": { "type": "boolean" }
							},
							"required": [
								"sources",
								"importableFields",
								"conflictFields",
								"unsupportedFields",
								"canApply"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 423,
						"column": 9
					}
				},
				"remoteDev/listDirectory": {
					service: "remoteDev",
					description: "List one directory on one host. Replaces `GET /list`. The answer carries a host-issued proof for the resolved directory and for every entry, so a later mutating verb cannot combine this host with a path that came from another one.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "host identity and absolute path (empty means home).",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteListRequest",
							create: perse_remote_dev_remoteDev_listDirectory_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"target": {
										"type": "object",
										"properties": { "hostId": {
											"type": "string",
											"description": "`local`, a configured host id, its `fromAlias`, or an ssh-config alias."
										} },
										"required": ["hostId"],
										"additionalProperties": true
									},
									"path": {
										"type": "string",
										"description": "Absolute directory path; empty string means that host's home directory."
									}
								},
								"required": ["target", "path"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteListRequest",
							create: perse_remote_dev_remoteDev_listDirectory_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"target": {
										"type": "object",
										"properties": { "hostId": {
											"type": "string",
											"description": "`local`, a configured host id, its `fromAlias`, or an ssh-config alias."
										} },
										"required": ["hostId"],
										"additionalProperties": false
									},
									"path": {
										"type": "string",
										"description": "Absolute directory path; empty string means that host's home directory."
									}
								},
								"required": ["target", "path"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteDirectoryListing",
						create: perse_remote_dev_remoteDev_listDirectory_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"target": {
									"type": "object",
									"properties": { "hostId": {
										"type": "string",
										"description": "`local`, a configured host id, its `fromAlias`, or an ssh-config alias."
									} },
									"required": ["hostId"],
									"additionalProperties": true
								},
								"host": {
									"type": "string",
									"description": "Stable identity of the host that answered."
								},
								"path": {
									"type": "string",
									"description": "Canonical directory path the host resolved (may differ from the request)."
								},
								"parent": {
									"type": "string",
									"description": "Parent directory in the same coordinates; absent at the root."
								},
								"home": {
									"type": "string",
									"description": "Login home directory on that host."
								},
								"location": {
									"type": "object",
									"properties": {
										"target": {
											"type": "object",
											"properties": { "hostId": {
												"type": "string",
												"description": "`local`, a configured host id, its `fromAlias`, or an ssh-config alias."
											} },
											"required": ["hostId"],
											"additionalProperties": true
										},
										"path": {
											"type": "string",
											"description": "Canonical path on that host, as the host resolved it."
										},
										"token": { "type": "string" }
									},
									"required": [
										"target",
										"path",
										"token"
									],
									"additionalProperties": true
								},
								"entries": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"name": { "type": "string" },
											"path": { "type": "string" },
											"hidden": { "type": "boolean" },
											"location": {
												"type": "object",
												"properties": {
													"target": {
														"type": "object",
														"properties": { "hostId": {
															"type": "string",
															"description": "`local`, a configured host id, its `fromAlias`, or an ssh-config alias."
														} },
														"required": ["hostId"],
														"additionalProperties": true
													},
													"path": {
														"type": "string",
														"description": "Canonical path on that host, as the host resolved it."
													},
													"token": { "type": "string" }
												},
												"required": [
													"target",
													"path",
													"token"
												],
												"additionalProperties": true,
												"description": "Proof binding `path` to the host that listed it."
											}
										},
										"required": [
											"name",
											"path",
											"hidden",
											"location"
										],
										"additionalProperties": true
									}
								}
							},
							"required": [
								"target",
								"host",
								"path",
								"home",
								"location",
								"entries"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 485,
						"column": 9
					}
				},
				"remoteDev/listTargets": {
					service: "remoteDev",
					description: "List selectable targets: the local machine, the user's configured hosts, and (on request) every `~/.ssh/config` alias. Replaces `GET /hosts` and its `all` / `probe` / `fresh` query switches.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "scope and probe switches.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteTargetsRequest",
							create: perse_remote_dev_remoteDev_listTargets_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"includeAll": {
										"type": "boolean",
										"description": "Include every `~/.ssh/config` alias, not only configured hosts."
									},
									"probe": {
										"type": "boolean",
										"description": "Run an ssh reachability probe for each ssh target."
									},
									"fresh": {
										"type": "boolean",
										"description": "Bypass the probe cache. Ignored unless `probe` is true."
									}
								},
								"required": [
									"includeAll",
									"probe",
									"fresh"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteTargetsRequest",
							create: perse_remote_dev_remoteDev_listTargets_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"includeAll": {
										"type": "boolean",
										"description": "Include every `~/.ssh/config` alias, not only configured hosts."
									},
									"probe": {
										"type": "boolean",
										"description": "Run an ssh reachability probe for each ssh target."
									},
									"fresh": {
										"type": "boolean",
										"description": "Bypass the probe cache. Ignored unless `probe` is true."
									}
								},
								"required": [
									"includeAll",
									"probe",
									"fresh"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteTargetsValue",
						create: perse_remote_dev_remoteDev_listTargets_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"targets": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": {
												"type": "string",
												"description": "Stable identity used on the wire."
											},
											"name": { "type": "string" },
											"kind": {
												"type": "string",
												"enum": ["local", "ssh"]
											},
											"state": {
												"type": "string",
												"enum": [
													"disconnected",
													"connected",
													"connecting",
													"reconnecting",
													"unknown"
												]
											},
											"detail": {
												"type": "string",
												"description": "Human-readable address summary."
											},
											"hostName": {
												"type": "string",
												"description": "Resolved ssh `HostName` for ssh targets; empty for `local`."
											},
											"user": {
												"type": "string",
												"description": "Resolved ssh user; empty when ssh itself decides."
											},
											"port": {
												"type": "string",
												"description": "Resolved ssh port; empty for the ssh default or when an alias decides."
											},
											"proxyJump": { "type": "string" },
											"aliases": {
												"type": "array",
												"items": { "type": "string" },
												"description": "Every `~/.ssh/config` alias that folds onto the same endpoint."
											},
											"jump": {
												"type": "boolean",
												"description": "This alias is only reachable as another host's ProxyJump."
											},
											"configured": {
												"type": "boolean",
												"description": "This row comes from the user's configured host list, not from ssh config."
											}
										},
										"required": [
											"id",
											"name",
											"kind",
											"state",
											"detail",
											"hostName",
											"user",
											"port",
											"proxyJump",
											"aliases",
											"jump",
											"configured"
										],
										"additionalProperties": true
									}
								},
								"configuredOnly": {
									"type": "boolean",
									"description": "`true` when only the user's configured hosts are returned."
								}
							},
							"required": ["targets", "configuredOnly"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 317,
						"column": 9
					}
				},
				"remoteDev/listTunnels": {
					service: "remoteDev",
					description: "List live tunnels. Replaces `GET /tunnel`.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "whether to include exited tunnels.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteTunnelListRequest",
							create: perse_remote_dev_remoteDev_listTunnels_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "includeDead": {
									"type": "boolean",
									"description": "Include tunnels whose ssh process already exited."
								} },
								"required": ["includeDead"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteTunnelListRequest",
							create: perse_remote_dev_remoteDev_listTunnels_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "includeDead": {
									"type": "boolean",
									"description": "Include tunnels whose ssh process already exited."
								} },
								"required": ["includeDead"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteTunnelListValue",
						create: perse_remote_dev_remoteDev_listTunnels_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": { "tunnels": {
								"type": "array",
								"items": {
									"type": "object",
									"properties": {
										"hostId": { "type": "string" },
										"url": { "type": "string" },
										"localPort": { "type": "number" },
										"remotePort": { "type": "string" },
										"alive": { "type": "boolean" },
										"openedAt": { "type": "number" },
										"refreshedAt": { "type": "number" },
										"authenticated": { "type": "boolean" },
										"warning": {
											"type": "string",
											"description": "Present when the address was handed over without a verified token."
										}
									},
									"required": [
										"hostId",
										"url",
										"localPort",
										"remotePort",
										"alive",
										"openedAt",
										"refreshedAt",
										"authenticated"
									],
									"additionalProperties": true
								}
							} },
							"required": ["tunnels"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 573,
						"column": 3
					}
				},
				"remoteDev/openProject": {
					service: "remoteDev",
					description: "Register a project path on a host and open that host's DSH. Replaces `POST /open-project`.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "proof-bearing location, persistence and token strictness.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteOpenProjectRequest",
							create: perse_remote_dev_remoteDev_openProject_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"location": {
										"type": "object",
										"properties": {
											"target": {
												"type": "object",
												"properties": { "hostId": {
													"type": "string",
													"description": "`local`, a configured host id, its `fromAlias`, or an ssh-config alias."
												} },
												"required": ["hostId"],
												"additionalProperties": true
											},
											"path": {
												"type": "string",
												"description": "Canonical path on that host, as the host resolved it."
											},
											"token": { "type": "string" }
										},
										"required": [
											"target",
											"path",
											"token"
										],
										"additionalProperties": true
									},
									"remember": {
										"type": "boolean",
										"description": "Persist the path on the host record."
									},
									"requireAuthentication": {
										"type": "boolean",
										"description": "Fail with `remote-dev/token-unavailable` instead of degrading."
									}
								},
								"required": [
									"location",
									"remember",
									"requireAuthentication"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteOpenProjectRequest",
							create: perse_remote_dev_remoteDev_openProject_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"location": {
										"type": "object",
										"properties": {
											"target": {
												"type": "object",
												"properties": { "hostId": {
													"type": "string",
													"description": "`local`, a configured host id, its `fromAlias`, or an ssh-config alias."
												} },
												"required": ["hostId"],
												"additionalProperties": false
											},
											"path": {
												"type": "string",
												"description": "Canonical path on that host, as the host resolved it."
											},
											"token": { "type": "string" }
										},
										"required": [
											"target",
											"path",
											"token"
										],
										"additionalProperties": false
									},
									"remember": {
										"type": "boolean",
										"description": "Persist the path on the host record."
									},
									"requireAuthentication": {
										"type": "boolean",
										"description": "Fail with `remote-dev/token-unavailable` instead of degrading."
									}
								},
								"required": [
									"location",
									"remember",
									"requireAuthentication"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteOpenedProject",
						create: perse_remote_dev_remoteDev_openProject_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"target": {
									"type": "object",
									"properties": { "hostId": {
										"type": "string",
										"description": "`local`, a configured host id, its `fromAlias`, or an ssh-config alias."
									} },
									"required": ["hostId"],
									"additionalProperties": true
								},
								"host": {
									"type": "string",
									"description": "Stable identity of the host that answered."
								},
								"path": {
									"type": "string",
									"description": "The path registered/opened on that host."
								},
								"url": { "type": "string" },
								"localPort": { "type": "number" },
								"remotePort": { "type": "string" },
								"reused": { "type": "boolean" },
								"authenticated": { "type": "boolean" },
								"saved": { "type": "boolean" },
								"warning": { "type": "string" }
							},
							"required": [
								"target",
								"host",
								"path",
								"url",
								"localPort",
								"remotePort",
								"reused",
								"authenticated",
								"saved"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 549,
						"column": 9
					}
				},
				"remoteDev/openTunnel": {
					service: "remoteDev",
					description: "Open or reuse the tunnel to one host's DSH. Replaces `POST /tunnel`.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "host identity and token strictness.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteTunnelRequest",
							create: perse_remote_dev_remoteDev_openTunnel_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"target": {
										"type": "object",
										"properties": { "hostId": {
											"type": "string",
											"description": "`local`, a configured host id, its `fromAlias`, or an ssh-config alias."
										} },
										"required": ["hostId"],
										"additionalProperties": true
									},
									"requireAuthentication": {
										"type": "boolean",
										"description": "Fail with `remote-dev/token-unavailable` instead of degrading."
									}
								},
								"required": ["target", "requireAuthentication"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteTunnelRequest",
							create: perse_remote_dev_remoteDev_openTunnel_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"target": {
										"type": "object",
										"properties": { "hostId": {
											"type": "string",
											"description": "`local`, a configured host id, its `fromAlias`, or an ssh-config alias."
										} },
										"required": ["hostId"],
										"additionalProperties": false
									},
									"requireAuthentication": {
										"type": "boolean",
										"description": "Fail with `remote-dev/token-unavailable` instead of degrading."
									}
								},
								"required": ["target", "requireAuthentication"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteTunnelView",
						create: perse_remote_dev_remoteDev_openTunnel_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"hostId": { "type": "string" },
								"url": { "type": "string" },
								"localPort": { "type": "number" },
								"remotePort": { "type": "string" },
								"alive": { "type": "boolean" },
								"openedAt": { "type": "number" },
								"refreshedAt": { "type": "number" },
								"authenticated": { "type": "boolean" },
								"warning": {
									"type": "string",
									"description": "Present when the address was handed over without a verified token."
								}
							},
							"required": [
								"hostId",
								"url",
								"localPort",
								"remotePort",
								"alive",
								"openedAt",
								"refreshedAt",
								"authenticated"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 561,
						"column": 9
					}
				},
				"remoteDev/pcCall": {
					service: "remoteDev",
					description: "Forward one allowlisted 1.2 developer method bound to this connection generation.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#PcCallRequest",
							create: perse_remote_dev_remoteDev_pcCall_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"profileId": { "type": "string" },
									"generation": { "type": "string" },
									"method": { "type": "string" },
									"paramsJson": {
										"type": "string",
										"description": "JSON-encoded object params, bounded and schema-checked by the bridge."
									}
								},
								"required": [
									"profileId",
									"generation",
									"method",
									"paramsJson"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#PcCallRequest",
							create: perse_remote_dev_remoteDev_pcCall_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"profileId": { "type": "string" },
									"generation": { "type": "string" },
									"method": { "type": "string" },
									"paramsJson": {
										"type": "string",
										"description": "JSON-encoded object params, bounded and schema-checked by the bridge."
									}
								},
								"required": [
									"profileId",
									"generation",
									"method",
									"paramsJson"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#PcCallValue",
						create: perse_remote_dev_remoteDev_pcCall_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": { "resultJson": { "type": "string" } },
							"required": ["resultJson"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 305,
						"column": 9
					}
				},
				"remoteDev/pcConnect": {
					service: "remoteDev",
					description: "Connect one already saved profile and verify its host identity.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#PcConnectRequest",
							create: perse_remote_dev_remoteDev_pcConnect_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "profileId": { "type": "string" } },
								"required": ["profileId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#PcConnectRequest",
							create: perse_remote_dev_remoteDev_pcConnect_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "profileId": { "type": "string" } },
								"required": ["profileId"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#PcConnectValue",
						create: perse_remote_dev_remoteDev_pcConnect_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"profileId": { "type": "string" },
								"hostId": { "type": "string" },
								"generation": { "type": "string" },
								"hostInfoJson": { "type": "string" }
							},
							"required": [
								"profileId",
								"hostId",
								"generation",
								"hostInfoJson"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 276,
						"column": 3
					}
				},
				"remoteDev/pcDisconnect": {
					service: "remoteDev",
					description: "Close only this plugin's local socket for the selected profile.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#PcDisconnectRequest",
							create: perse_remote_dev_remoteDev_pcDisconnect_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "profileId": { "type": "string" } },
								"required": ["profileId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#PcDisconnectRequest",
							create: perse_remote_dev_remoteDev_pcDisconnect_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "profileId": { "type": "string" } },
								"required": ["profileId"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#PcDisconnectValue",
						create: perse_remote_dev_remoteDev_pcDisconnect_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"profileId": { "type": "string" },
								"disconnected": {
									"type": "boolean",
									"const": true
								}
							},
							"required": ["profileId", "disconnected"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 282,
						"column": 9
					}
				},
				"remoteDev/pcForget": {
					service: "remoteDev",
					description: "Remove one locally stored device credential and its local socket.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#PcForgetRequest",
							create: perse_remote_dev_remoteDev_pcForget_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "profileId": { "type": "string" } },
								"required": ["profileId"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#PcForgetRequest",
							create: perse_remote_dev_remoteDev_pcForget_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "profileId": { "type": "string" } },
								"required": ["profileId"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#PcForgetValue",
						create: perse_remote_dev_remoteDev_pcForget_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"profileId": { "type": "string" },
								"forgotten": {
									"type": "boolean",
									"const": true
								}
							},
							"required": ["profileId", "forgotten"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 290,
						"column": 9
					}
				},
				"remoteDev/pcPairConfirm": {
					service: "remoteDev",
					description: "Consume one explicit pairing confirmation, exchange once, then verify host.info.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#PcPairConfirmRequest",
							create: perse_remote_dev_remoteDev_pcPairConfirm_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"confirmationId": { "type": "string" },
									"deviceName": { "type": "string" }
								},
								"required": ["confirmationId", "deviceName"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#PcPairConfirmRequest",
							create: perse_remote_dev_remoteDev_pcPairConfirm_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"confirmationId": { "type": "string" },
									"deviceName": { "type": "string" }
								},
								"required": ["confirmationId", "deviceName"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#PcConnectValue",
						create: perse_remote_dev_remoteDev_pcPairConfirm_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"profileId": { "type": "string" },
								"hostId": { "type": "string" },
								"generation": { "type": "string" },
								"hostInfoJson": { "type": "string" }
							},
							"required": [
								"profileId",
								"hostId",
								"generation",
								"hostInfoJson"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 270,
						"column": 3
					}
				},
				"remoteDev/pcPairPreview": {
					service: "remoteDev",
					description: "Parse and preview an iOS-compatible short-lived pairing link without network access.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#PcPairPreviewRequest",
							create: perse_remote_dev_remoteDev_pcPairPreview_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "link": { "type": "string" } },
								"required": ["link"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#PcPairPreviewRequest",
							create: perse_remote_dev_remoteDev_pcPairPreview_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "link": { "type": "string" } },
								"required": ["link"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#PcPairPreviewValue",
						create: perse_remote_dev_remoteDev_pcPairPreview_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"confirmationId": { "type": "string" },
								"hostId": { "type": "string" },
								"hostName": { "type": "string" },
								"endpoint": { "type": "string" },
								"networkMode": {
									"type": "string",
									"enum": [
										"https",
										"tailnet",
										"local"
									]
								},
								"expiresAt": { "type": "string" },
								"accessSummary": { "type": "string" }
							},
							"required": [
								"confirmationId",
								"hostId",
								"hostName",
								"endpoint",
								"networkMode",
								"expiresAt",
								"accessSummary"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 263,
						"column": 3
					}
				},
				"remoteDev/pcProfiles": {
					service: "remoteDev",
					description: "List sanitized local PC profiles. Device bearer tokens are never returned.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#PcProfilesRequest",
							create: perse_remote_dev_remoteDev_pcProfiles_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {},
								"required": [],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#PcProfilesRequest",
							create: perse_remote_dev_remoteDev_pcProfiles_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {},
								"required": [],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#PcProfilesValue",
						create: perse_remote_dev_remoteDev_pcProfiles_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": { "profiles": {
								"type": "array",
								"items": {
									"type": "object",
									"properties": {
										"profileId": { "type": "string" },
										"endpoint": { "type": "string" },
										"networkMode": {
											"type": "string",
											"enum": [
												"https",
												"tailnet",
												"local"
											]
										},
										"hostId": { "type": "string" },
										"hostName": { "type": "string" },
										"deviceId": { "type": "string" },
										"deviceName": { "type": "string" },
										"status": {
											"type": "string",
											"enum": [
												"disconnected",
												"connected",
												"offline",
												"revoked"
											]
										},
										"protocolVersion": { "type": "string" },
										"verifiedAt": { "type": "string" }
									},
									"required": [
										"profileId",
										"endpoint",
										"networkMode",
										"hostId",
										"hostName",
										"deviceId",
										"deviceName",
										"status"
									],
									"additionalProperties": true
								}
							} },
							"required": ["profiles"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 255,
						"column": 9
					}
				},
				"remoteDev/pcRevoke": {
					service: "remoteDev",
					description: "Revoke the connected device on the remote host, then erase its local grant.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#PcRevokeRequest",
							create: perse_remote_dev_remoteDev_pcRevoke_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"profileId": { "type": "string" },
									"generation": { "type": "string" }
								},
								"required": ["profileId", "generation"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#PcRevokeRequest",
							create: perse_remote_dev_remoteDev_pcRevoke_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"profileId": { "type": "string" },
									"generation": { "type": "string" }
								},
								"required": ["profileId", "generation"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#PcRevokeValue",
						create: perse_remote_dev_remoteDev_pcRevoke_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"profileId": { "type": "string" },
								"revoked": {
									"type": "boolean",
									"const": true
								}
							},
							"required": ["profileId", "revoked"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 298,
						"column": 9
					}
				},
				"remoteDev/readConfiguration": {
					service: "remoteDev",
					description: "Read the effective configuration. Replaces `GET /config`.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "whether to include ssh-config import candidates.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteConfigurationRequest",
							create: perse_remote_dev_remoteDev_readConfiguration_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "includeCandidates": {
									"type": "boolean",
									"description": "Include the `~/.ssh/config` import candidates."
								} },
								"required": ["includeCandidates"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteConfigurationRequest",
							create: perse_remote_dev_remoteDev_readConfiguration_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "includeCandidates": {
									"type": "boolean",
									"description": "Include the `~/.ssh/config` import candidates."
								} },
								"required": ["includeCandidates"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteConfigurationValue",
						create: perse_remote_dev_remoteDev_readConfiguration_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"hosts": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": { "type": "string" },
											"name": { "type": "string" },
											"address": {
												"type": "string",
												"description": "Network address; empty when an ssh alias is used."
											},
											"port": { "type": "string" },
											"username": { "type": "string" },
											"auth": {
												"type": "string",
												"description": "`key` | `password` | `agent`; validated on write."
											},
											"keyPath": {
												"type": "string",
												"description": "Private key path for direct connections; empty means the ssh default/agent."
											},
											"passwordRef": {
												"type": "string",
												"description": "Credential reference name; plaintext passwords are never stored."
											},
											"fromAlias": {
												"type": "string",
												"description": "`~/.ssh/config` alias this record was imported from, when any."
											},
											"projectPath": {
												"type": "string",
												"description": "Last project path used on this host."
											},
											"remotePort": {
												"type": "string",
												"description": "Remote DSH listen port; `3080` when unset."
											},
											"projects": {
												"type": "array",
												"items": { "type": "string" }
											}
										},
										"required": [
											"id",
											"name",
											"address",
											"port",
											"username",
											"auth",
											"keyPath",
											"passwordRef",
											"fromAlias",
											"projectPath",
											"remotePort",
											"projects"
										],
										"additionalProperties": true
									}
								},
								"migrated": {
									"type": "boolean",
									"description": "The legacy `targets` array was folded into `hosts` for this read."
								},
								"enginePath": { "type": "string" },
								"resolved": {
									"type": "object",
									"properties": {
										"host": {
											"type": "string",
											"description": "ssh target the host would use: alias first, else `user@address`."
										},
										"hostId": {
											"type": "string",
											"description": "Stable identity of the same target."
										},
										"projectPath": { "type": "string" },
										"mDir": {
											"type": "string",
											"description": "Stored batch directory (M) for the review loop; empty when unset."
										},
										"hub": { "type": "string" },
										"verifyCmd": { "type": "string" }
									},
									"required": [
										"host",
										"hostId",
										"projectPath",
										"mDir",
										"hub",
										"verifyCmd"
									],
									"additionalProperties": true
								},
								"configured": { "type": "boolean" },
								"missing": {
									"type": "array",
									"items": { "type": "string" }
								},
								"hint": { "type": "string" },
								"candidates": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"id": {
												"type": "string",
												"description": "Stable identity used on the wire."
											},
											"name": { "type": "string" },
											"kind": {
												"type": "string",
												"enum": ["local", "ssh"]
											},
											"state": {
												"type": "string",
												"enum": [
													"disconnected",
													"connected",
													"connecting",
													"reconnecting",
													"unknown"
												]
											},
											"detail": {
												"type": "string",
												"description": "Human-readable address summary."
											},
											"hostName": {
												"type": "string",
												"description": "Resolved ssh `HostName` for ssh targets; empty for `local`."
											},
											"user": {
												"type": "string",
												"description": "Resolved ssh user; empty when ssh itself decides."
											},
											"port": {
												"type": "string",
												"description": "Resolved ssh port; empty for the ssh default or when an alias decides."
											},
											"proxyJump": { "type": "string" },
											"aliases": {
												"type": "array",
												"items": { "type": "string" },
												"description": "Every `~/.ssh/config` alias that folds onto the same endpoint."
											},
											"jump": {
												"type": "boolean",
												"description": "This alias is only reachable as another host's ProxyJump."
											},
											"configured": {
												"type": "boolean",
												"description": "This row comes from the user's configured host list, not from ssh config."
											}
										},
										"required": [
											"id",
											"name",
											"kind",
											"state",
											"detail",
											"hostName",
											"user",
											"port",
											"proxyJump",
											"aliases",
											"jump",
											"configured"
										],
										"additionalProperties": true
									},
									"description": "`~/.ssh/config` aliases offered as import sources."
								}
							},
							"required": [
								"hosts",
								"migrated",
								"enginePath",
								"resolved",
								"configured",
								"missing",
								"hint",
								"candidates"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 359,
						"column": 9
					}
				},
				"remoteDev/reviewApply": {
					service: "remoteDev",
					description: "Approve the selected files: apply, verify, push the baseline, resync M. Replaces `POST /review/apply`. Step failures are values (`ok: false`), not thrown errors — the caller needs the step trail either way.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "review bundle, selected files, base, verification switch.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteReviewApplyRequest",
							create: perse_remote_dev_remoteDev_reviewApply_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"target": {
										"type": "object",
										"properties": {
											"hostId": { "type": "string" },
											"projectPath": {
												"type": "string",
												"description": "W: the project working tree the batch is applied to."
											},
											"mDir": {
												"type": "string",
												"description": "M: the source tree the batch was produced from."
											},
											"hub": {
												"type": "string",
												"description": "The hub repository holding the `rd-base` baseline."
											},
											"verifyCmd": {
												"type": "string",
												"description": "Local verification command; empty means no verification step."
											},
											"token": {
												"type": "string",
												"description": "Host-issued proof over every field above; required by mutating verbs."
											}
										},
										"required": [
											"hostId",
											"projectPath",
											"mDir",
											"hub",
											"verifyCmd"
										],
										"additionalProperties": true
									},
									"files": {
										"type": "array",
										"items": { "type": "string" }
									},
									"base": {
										"type": "string",
										"description": "Explicit baseline; empty string asks the host to resolve `rd-base`."
									},
									"verify": {
										"type": "boolean",
										"description": "Run the target's `verifyCmd` between apply and baseline push."
									}
								},
								"required": [
									"target",
									"files",
									"base",
									"verify"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteReviewApplyRequest",
							create: perse_remote_dev_remoteDev_reviewApply_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"target": {
										"type": "object",
										"properties": {
											"hostId": { "type": "string" },
											"projectPath": {
												"type": "string",
												"description": "W: the project working tree the batch is applied to."
											},
											"mDir": {
												"type": "string",
												"description": "M: the source tree the batch was produced from."
											},
											"hub": {
												"type": "string",
												"description": "The hub repository holding the `rd-base` baseline."
											},
											"verifyCmd": {
												"type": "string",
												"description": "Local verification command; empty means no verification step."
											},
											"token": {
												"type": "string",
												"description": "Host-issued proof over every field above; required by mutating verbs."
											}
										},
										"required": [
											"hostId",
											"projectPath",
											"mDir",
											"hub",
											"verifyCmd"
										],
										"additionalProperties": false
									},
									"files": {
										"type": "array",
										"items": { "type": "string" }
									},
									"base": {
										"type": "string",
										"description": "Explicit baseline; empty string asks the host to resolve `rd-base`."
									},
									"verify": {
										"type": "boolean",
										"description": "Run the target's `verifyCmd` between apply and baseline push."
									}
								},
								"required": [
									"target",
									"files",
									"base",
									"verify"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteReviewApplyResult",
						create: perse_remote_dev_remoteDev_reviewApply_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"ok": { "type": "boolean" },
								"failedAt": { "type": "string" },
								"steps": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"step": { "type": "string" },
											"code": { "type": "number" },
											"output": { "type": "string" }
										},
										"required": [
											"step",
											"code",
											"output"
										],
										"additionalProperties": true
									}
								},
								"base": { "type": "string" },
								"head": { "type": "string" },
								"files": {
									"type": "array",
									"items": { "type": "string" }
								},
								"verified": { "type": "boolean" },
								"note": { "type": "string" }
							},
							"required": [
								"ok",
								"steps",
								"base",
								"head",
								"files",
								"verified",
								"note"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 650,
						"column": 9
					}
				},
				"remoteDev/reviewBatch": {
					service: "remoteDev",
					description: "Read one review batch. Replaces `GET /review/batch`.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "review identity bundle plus an optional explicit base.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteReviewBatchRequest",
							create: perse_remote_dev_remoteDev_reviewBatch_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"target": {
										"type": "object",
										"properties": {
											"hostId": { "type": "string" },
											"projectPath": {
												"type": "string",
												"description": "W: the project working tree the batch is applied to."
											},
											"mDir": {
												"type": "string",
												"description": "M: the source tree the batch was produced from."
											},
											"hub": {
												"type": "string",
												"description": "The hub repository holding the `rd-base` baseline."
											},
											"verifyCmd": {
												"type": "string",
												"description": "Local verification command; empty means no verification step."
											},
											"token": {
												"type": "string",
												"description": "Host-issued proof over every field above; required by mutating verbs."
											}
										},
										"required": [
											"hostId",
											"projectPath",
											"mDir",
											"hub",
											"verifyCmd"
										],
										"additionalProperties": true
									},
									"base": {
										"type": "string",
										"description": "Explicit baseline; empty string asks the host to resolve `rd-base`."
									}
								},
								"required": ["target", "base"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteReviewBatchRequest",
							create: perse_remote_dev_remoteDev_reviewBatch_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"target": {
										"type": "object",
										"properties": {
											"hostId": { "type": "string" },
											"projectPath": {
												"type": "string",
												"description": "W: the project working tree the batch is applied to."
											},
											"mDir": {
												"type": "string",
												"description": "M: the source tree the batch was produced from."
											},
											"hub": {
												"type": "string",
												"description": "The hub repository holding the `rd-base` baseline."
											},
											"verifyCmd": {
												"type": "string",
												"description": "Local verification command; empty means no verification step."
											},
											"token": {
												"type": "string",
												"description": "Host-issued proof over every field above; required by mutating verbs."
											}
										},
										"required": [
											"hostId",
											"projectPath",
											"mDir",
											"hub",
											"verifyCmd"
										],
										"additionalProperties": false
									},
									"base": {
										"type": "string",
										"description": "Explicit baseline; empty string asks the host to resolve `rd-base`."
									}
								},
								"required": ["target", "base"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteReviewBatch",
						create: perse_remote_dev_remoteDev_reviewBatch_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"target": {
									"type": "object",
									"properties": {
										"hostId": { "type": "string" },
										"projectPath": {
											"type": "string",
											"description": "W: the project working tree the batch is applied to."
										},
										"mDir": {
											"type": "string",
											"description": "M: the source tree the batch was produced from."
										},
										"hub": {
											"type": "string",
											"description": "The hub repository holding the `rd-base` baseline."
										},
										"verifyCmd": {
											"type": "string",
											"description": "Local verification command; empty means no verification step."
										},
										"token": {
											"type": "string",
											"description": "Host-issued proof over every field above; required by mutating verbs."
										}
									},
									"required": [
										"hostId",
										"projectPath",
										"mDir",
										"hub",
										"verifyCmd"
									],
									"additionalProperties": true
								},
								"engine": { "type": "string" },
								"base": { "type": "string" },
								"head": { "type": "string" },
								"files": {
									"type": "array",
									"items": {
										"type": "object",
										"properties": {
											"path": { "type": "string" },
											"add": {
												"type": "number",
												"description": "Added lines; absent for a deletion."
											},
											"del": {
												"type": "number",
												"description": "Deleted lines; absent for an addition."
											},
											"status": {
												"type": "string",
												"enum": [
													"A",
													"M",
													"D"
												]
											}
										},
										"required": ["path", "status"],
										"additionalProperties": true
									}
								},
								"diff": { "type": "string" },
								"empty": { "type": "boolean" }
							},
							"required": [
								"target",
								"engine",
								"base",
								"head",
								"files",
								"diff",
								"empty"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 624,
						"column": 9
					}
				},
				"remoteDev/reviewReject": {
					service: "remoteDev",
					description: "Record a rejection (append-only ledger). Replaces `POST /review/reject`.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "review bundle, files, base, and the mandatory reason.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteReviewRejectRequest",
							create: perse_remote_dev_remoteDev_reviewReject_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"target": {
										"type": "object",
										"properties": {
											"hostId": { "type": "string" },
											"projectPath": {
												"type": "string",
												"description": "W: the project working tree the batch is applied to."
											},
											"mDir": {
												"type": "string",
												"description": "M: the source tree the batch was produced from."
											},
											"hub": {
												"type": "string",
												"description": "The hub repository holding the `rd-base` baseline."
											},
											"verifyCmd": {
												"type": "string",
												"description": "Local verification command; empty means no verification step."
											},
											"token": {
												"type": "string",
												"description": "Host-issued proof over every field above; required by mutating verbs."
											}
										},
										"required": [
											"hostId",
											"projectPath",
											"mDir",
											"hub",
											"verifyCmd"
										],
										"additionalProperties": true
									},
									"files": {
										"type": "array",
										"items": { "type": "string" }
									},
									"base": { "type": "string" },
									"comment": { "type": "string" }
								},
								"required": [
									"target",
									"files",
									"base",
									"comment"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteReviewRejectRequest",
							create: perse_remote_dev_remoteDev_reviewReject_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"target": {
										"type": "object",
										"properties": {
											"hostId": { "type": "string" },
											"projectPath": {
												"type": "string",
												"description": "W: the project working tree the batch is applied to."
											},
											"mDir": {
												"type": "string",
												"description": "M: the source tree the batch was produced from."
											},
											"hub": {
												"type": "string",
												"description": "The hub repository holding the `rd-base` baseline."
											},
											"verifyCmd": {
												"type": "string",
												"description": "Local verification command; empty means no verification step."
											},
											"token": {
												"type": "string",
												"description": "Host-issued proof over every field above; required by mutating verbs."
											}
										},
										"required": [
											"hostId",
											"projectPath",
											"mDir",
											"hub",
											"verifyCmd"
										],
										"additionalProperties": false
									},
									"files": {
										"type": "array",
										"items": { "type": "string" }
									},
									"base": { "type": "string" },
									"comment": { "type": "string" }
								},
								"required": [
									"target",
									"files",
									"base",
									"comment"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteDecisionRecord",
						create: perse_remote_dev_remoteDev_reviewReject_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"ts": { "type": "string" },
								"kind": { "type": "string" },
								"host": { "type": "string" },
								"base": { "type": "string" },
								"files": {
									"type": "array",
									"items": { "type": "string" }
								},
								"comment": { "type": "string" }
							},
							"required": [
								"ts",
								"kind",
								"host",
								"base",
								"files",
								"comment"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 752,
						"column": 9
					}
				},
				"remoteDev/reviewRollback": {
					service: "remoteDev",
					description: "Roll the project tree back to a baseline ref. Replaces `POST /review/rollback`.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "review bundle plus the baseline ref.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteReviewRollbackRequest",
							create: perse_remote_dev_remoteDev_reviewRollback_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"target": {
										"type": "object",
										"properties": {
											"hostId": { "type": "string" },
											"projectPath": {
												"type": "string",
												"description": "W: the project working tree the batch is applied to."
											},
											"mDir": {
												"type": "string",
												"description": "M: the source tree the batch was produced from."
											},
											"hub": {
												"type": "string",
												"description": "The hub repository holding the `rd-base` baseline."
											},
											"verifyCmd": {
												"type": "string",
												"description": "Local verification command; empty means no verification step."
											},
											"token": {
												"type": "string",
												"description": "Host-issued proof over every field above; required by mutating verbs."
											}
										},
										"required": [
											"hostId",
											"projectPath",
											"mDir",
											"hub",
											"verifyCmd"
										],
										"additionalProperties": true
									},
									"ref": { "type": "string" }
								},
								"required": ["target", "ref"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteReviewRollbackRequest",
							create: perse_remote_dev_remoteDev_reviewRollback_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"target": {
										"type": "object",
										"properties": {
											"hostId": { "type": "string" },
											"projectPath": {
												"type": "string",
												"description": "W: the project working tree the batch is applied to."
											},
											"mDir": {
												"type": "string",
												"description": "M: the source tree the batch was produced from."
											},
											"hub": {
												"type": "string",
												"description": "The hub repository holding the `rd-base` baseline."
											},
											"verifyCmd": {
												"type": "string",
												"description": "Local verification command; empty means no verification step."
											},
											"token": {
												"type": "string",
												"description": "Host-issued proof over every field above; required by mutating verbs."
											}
										},
										"required": [
											"hostId",
											"projectPath",
											"mDir",
											"hub",
											"verifyCmd"
										],
										"additionalProperties": false
									},
									"ref": { "type": "string" }
								},
								"required": ["target", "ref"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteReviewRollbackResult",
						create: perse_remote_dev_remoteDev_reviewRollback_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"ok": { "type": "boolean" },
								"code": { "type": "number" },
								"ref": { "type": "string" },
								"output": { "type": "string" },
								"note": { "type": "string" }
							},
							"required": [
								"ok",
								"code",
								"ref",
								"output",
								"note"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 775,
						"column": 9
					}
				},
				"remoteDev/reviewStatus": {
					service: "remoteDev",
					description: "Read the review status of one target. Replaces `GET /review/status`.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "review identity bundle.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteReviewStatusRequest",
							create: perse_remote_dev_remoteDev_reviewStatus_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "target": {
									"type": "object",
									"properties": {
										"hostId": { "type": "string" },
										"projectPath": {
											"type": "string",
											"description": "W: the project working tree the batch is applied to."
										},
										"mDir": {
											"type": "string",
											"description": "M: the source tree the batch was produced from."
										},
										"hub": {
											"type": "string",
											"description": "The hub repository holding the `rd-base` baseline."
										},
										"verifyCmd": {
											"type": "string",
											"description": "Local verification command; empty means no verification step."
										},
										"token": {
											"type": "string",
											"description": "Host-issued proof over every field above; required by mutating verbs."
										}
									},
									"required": [
										"hostId",
										"projectPath",
										"mDir",
										"hub",
										"verifyCmd"
									],
									"additionalProperties": true
								} },
								"required": ["target"],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteReviewStatusRequest",
							create: perse_remote_dev_remoteDev_reviewStatus_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": { "target": {
									"type": "object",
									"properties": {
										"hostId": { "type": "string" },
										"projectPath": {
											"type": "string",
											"description": "W: the project working tree the batch is applied to."
										},
										"mDir": {
											"type": "string",
											"description": "M: the source tree the batch was produced from."
										},
										"hub": {
											"type": "string",
											"description": "The hub repository holding the `rd-base` baseline."
										},
										"verifyCmd": {
											"type": "string",
											"description": "Local verification command; empty means no verification step."
										},
										"token": {
											"type": "string",
											"description": "Host-issued proof over every field above; required by mutating verbs."
										}
									},
									"required": [
										"hostId",
										"projectPath",
										"mDir",
										"hub",
										"verifyCmd"
									],
									"additionalProperties": false
								} },
								"required": ["target"],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteReviewStatus",
						create: perse_remote_dev_remoteDev_reviewStatus_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"target": {
									"type": "object",
									"properties": {
										"hostId": { "type": "string" },
										"projectPath": {
											"type": "string",
											"description": "W: the project working tree the batch is applied to."
										},
										"mDir": {
											"type": "string",
											"description": "M: the source tree the batch was produced from."
										},
										"hub": {
											"type": "string",
											"description": "The hub repository holding the `rd-base` baseline."
										},
										"verifyCmd": {
											"type": "string",
											"description": "Local verification command; empty means no verification step."
										},
										"token": {
											"type": "string",
											"description": "Host-issued proof over every field above; required by mutating verbs."
										}
									},
									"required": [
										"hostId",
										"projectPath",
										"mDir",
										"hub",
										"verifyCmd"
									],
									"additionalProperties": true
								},
								"base": { "type": "string" },
								"head": { "type": "string" },
								"dirty": { "type": "number" },
								"missing": { "type": "boolean" }
							},
							"required": [
								"target",
								"dirty",
								"missing"
							],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 605,
						"column": 9
					}
				},
				"remoteDev/updateConfiguration": {
					service: "remoteDev",
					description: "Write host records and the target chain. Replaces `POST /config`. Validation problems are returned as one typed failure instead of a hand-built body.",
					invocation: { kind: "direct" },
					parameters: [{
						name: "request",
						description: "the records plus the scalar chain fields.",
						source: "json",
						codec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteConfigurationUpdate",
							create: perse_remote_dev_remoteDev_updateConfiguration_parameter_0$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"hosts": {
										"type": "array",
										"items": {
											"type": "object",
											"properties": {
												"id": { "type": "string" },
												"name": { "type": "string" },
												"address": {
													"type": "string",
													"description": "Network address; empty when an ssh alias is used."
												},
												"port": { "type": "string" },
												"username": { "type": "string" },
												"auth": {
													"type": "string",
													"description": "`key` | `password` | `agent`; validated on write."
												},
												"keyPath": {
													"type": "string",
													"description": "Private key path for direct connections; empty means the ssh default/agent."
												},
												"passwordRef": {
													"type": "string",
													"description": "Credential reference name; plaintext passwords are never stored."
												},
												"fromAlias": {
													"type": "string",
													"description": "`~/.ssh/config` alias this record was imported from, when any."
												},
												"projectPath": {
													"type": "string",
													"description": "Last project path used on this host."
												},
												"remotePort": {
													"type": "string",
													"description": "Remote DSH listen port; `3080` when unset."
												},
												"projects": {
													"type": "array",
													"items": { "type": "string" }
												}
											},
											"required": [
												"id",
												"name",
												"address",
												"port",
												"username",
												"auth",
												"keyPath",
												"passwordRef",
												"fromAlias",
												"projectPath",
												"remotePort",
												"projects"
											],
											"additionalProperties": true
										}
									},
									"projectPath": {
										"type": "string",
										"description": "Empty string leaves the stored project path untouched."
									},
									"mDir": {
										"type": "string",
										"description": "Empty string leaves the stored batch directory (M) untouched."
									},
									"hub": {
										"type": "string",
										"description": "Empty string leaves the stored hub untouched."
									},
									"enginePath": {
										"type": "string",
										"description": "Empty string leaves the stored engine path untouched."
									}
								},
								"required": [
									"hosts",
									"projectPath",
									"mDir",
									"hub",
									"enginePath"
								],
								"additionalProperties": true
							}
						},
						strictCodec: {
							mode: "strict",
							typeSymbol: "perse-remote-dev/types#RemoteConfigurationUpdate",
							create: perse_remote_dev_remoteDev_updateConfiguration_parameter_0_strict$schema,
							jsonSchema: {
								"type": "object",
								"properties": {
									"hosts": {
										"type": "array",
										"items": {
											"type": "object",
											"properties": {
												"id": { "type": "string" },
												"name": { "type": "string" },
												"address": {
													"type": "string",
													"description": "Network address; empty when an ssh alias is used."
												},
												"port": { "type": "string" },
												"username": { "type": "string" },
												"auth": {
													"type": "string",
													"description": "`key` | `password` | `agent`; validated on write."
												},
												"keyPath": {
													"type": "string",
													"description": "Private key path for direct connections; empty means the ssh default/agent."
												},
												"passwordRef": {
													"type": "string",
													"description": "Credential reference name; plaintext passwords are never stored."
												},
												"fromAlias": {
													"type": "string",
													"description": "`~/.ssh/config` alias this record was imported from, when any."
												},
												"projectPath": {
													"type": "string",
													"description": "Last project path used on this host."
												},
												"remotePort": {
													"type": "string",
													"description": "Remote DSH listen port; `3080` when unset."
												},
												"projects": {
													"type": "array",
													"items": { "type": "string" }
												}
											},
											"required": [
												"id",
												"name",
												"address",
												"port",
												"username",
												"auth",
												"keyPath",
												"passwordRef",
												"fromAlias",
												"projectPath",
												"remotePort",
												"projects"
											],
											"additionalProperties": false
										}
									},
									"projectPath": {
										"type": "string",
										"description": "Empty string leaves the stored project path untouched."
									},
									"mDir": {
										"type": "string",
										"description": "Empty string leaves the stored batch directory (M) untouched."
									},
									"hub": {
										"type": "string",
										"description": "Empty string leaves the stored hub untouched."
									},
									"enginePath": {
										"type": "string",
										"description": "Empty string leaves the stored engine path untouched."
									}
								},
								"required": [
									"hosts",
									"projectPath",
									"mDir",
									"hub",
									"enginePath"
								],
								"additionalProperties": false
							}
						}
					}],
					cancellation: { parameter: "signal" },
					result: {
						mode: "strict",
						typeSymbol: "perse-remote-dev/types#RemoteConfigurationUpdateValue",
						create: perse_remote_dev_remoteDev_updateConfiguration_result$schema,
						jsonSchema: {
							"type": "object",
							"properties": {
								"configured": { "type": "boolean" },
								"missing": {
									"type": "array",
									"items": { "type": "string" }
								}
							},
							"required": ["configured", "missing"],
							"additionalProperties": true
						}
					},
					sourceLocation: {
						"file": "packages/perse-remote-dev/src/index.ts",
						"line": 393,
						"column": 9
					}
				}
			}
		}, zod.z);
		// packages/perse-remote-dev/src/client/connections/controller.ts
		const EMPTY_CONNECTION = {
			status: "disconnected",
			profileId: null,
			hostId: null,
			generation: null,
			hostInfo: null,
			error: null
		};
		/** Owns only local pairing/profile and verified socket state. It never creates tasks or native sessions. */
		var PcConnectionModel = class {
			remote;
			defaultDeviceName;
			listeners = /* @__PURE__ */ new Set();
			state = {
				profiles: [],
				connection: EMPTY_CONNECTION,
				pairingPreview: null,
				failure: null,
				nativeSessionSupport: "unavailable",
				pendingCreations: []
			};
			revision = 0;
			profileRefresh;
			previewRequest = 0;
			disposed = false;
			creationReceiptAcknowledger = () => void 0;
			constructor(remote, options = {}) {
				this.remote = remote;
				this.defaultDeviceName = options.deviceName ?? "Persevere with DSH 桌面端";
			}
			getSnapshot = () => this.state;
			setNativeSessionSupport(status) {
				if (this.state.nativeSessionSupport === status || this.disposed) return;
				this.patch({ nativeSessionSupport: status });
			}
			markConnectionOffline(profileId, generation, reason) {
				const current = this.state.connection;
				if (this.disposed || current.profileId !== profileId || current.generation !== generation) return;
				const failure = exceptionFailure(reason);
				this.patch({
					connection: {
						...current,
						status: "error",
						error: failure
					},
					profiles: this.state.profiles.map((profile) => profile.profileId === profileId ? {
						...profile,
						status: "offline"
					} : profile),
					failure
				});
			}
			setPendingCreations(value) {
				if (this.disposed) return;
				this.patch({ pendingCreations: value });
			}
			setCreationReceiptAcknowledger(handler) {
				this.creationReceiptAcknowledger = handler;
			}
			acknowledgeCreationReceipt(operationId) {
				if (!this.disposed) this.creationReceiptAcknowledger(operationId);
			}
			subscribe = (listener) => {
				if (this.disposed) return () => void 0;
				this.listeners.add(listener);
				return () => this.listeners.delete(listener);
			};
			async refreshProfiles() {
				if (this.profileRefresh !== void 0) return this.profileRefresh;
				const pending = this.loadProfiles().finally(() => {
					if (this.profileRefresh === pending) this.profileRefresh = void 0;
				});
				this.profileRefresh = pending;
				return pending;
			}
			async previewPairing(link) {
				this.patch({
					pairingPreview: null,
					failure: null
				});
				if (link.length > 8192) return this.fail(makeFailure("remote-dev/pc-pairing-invalid", "配对链接不能超过 8 KiB。", { limitBytes: 8192 }));
				const request = ++this.previewRequest;
				const outcome = await this.bridge(this.remote.pcPairPreview({ link }));
				if (!outcome.ok) return this.fail(outcome.failure);
				if (this.disposed || request !== this.previewRequest) return failed(stale("pair preview"));
				this.patch({
					pairingPreview: outcome.value,
					failure: null
				});
				return success(outcome.value);
			}
			async confirmPairing(confirmationId, deviceName = this.defaultDeviceName) {
				const preview = this.state.pairingPreview;
				if (preview === null || preview.confirmationId !== confirmationId) return this.fail(makeFailure("remote-dev/pc-pairing-invalid", "配对预览已失效，请重新预览链接。", null));
				const normalizedName = deviceName.trim();
				if (normalizedName.length < 1 || normalizedName.length > 100) return this.fail(makeFailure("remote-dev/pc-pairing-invalid", "设备名称需为 1 到 100 个字符。", null));
				this.previewRequest += 1;
				const revision = this.beginConnection(preview.hostId);
				this.patch({ pairingPreview: null });
				const outcome = await this.bridge(this.remote.pcPairConfirm({
					confirmationId,
					deviceName: normalizedName
				}));
				if (revision !== this.revision || this.disposed) {
					if (outcome.ok) this.refreshProfiles();
					return failed(stale("pair confirmation"));
				}
				if (!outcome.ok) return this.connectionFailure(outcome.failure);
				return this.accept(outcome.value, revision, preview.hostId, true);
			}
			async connectProfile(profileId) {
				if (!profileId) return this.fail(makeFailure("remote-dev/pc-profile-required", "请选择一个已保存的主机。", null));
				const profile = this.state.profiles.find((item) => item.profileId === profileId);
				if (profile === void 0) return this.fail(makeFailure("remote-dev/pc-profile-required", "找不到该主机配置，请刷新连接列表。", { profileId }));
				const revision = this.beginConnection(profileId);
				const outcome = await this.bridge(this.remote.pcConnect({ profileId }));
				if (revision !== this.revision || this.disposed) {
					if (outcome.ok) this.refreshProfiles();
					return failed(stale("connect"));
				}
				if (!outcome.ok) return this.connectionFailure(outcome.failure);
				if (outcome.value.hostId !== profile.hostId) {
					const identityFailure = makeFailure("remote-dev/pc-pairing-invalid", "已连接主机的身份与保存配置不匹配。", {
						expectedHostId: profile.hostId,
						actualHostId: outcome.value.hostId
					});
					return this.connectionFailure(identityFailure);
				}
				return this.accept(outcome.value, revision, profile.hostId);
			}
			async disconnectProfile(profileId = this.state.connection.profileId ?? "") {
				if (!profileId) return this.fail(makeFailure("remote-dev/pc-profile-required", "当前没有已连接的主机。", null));
				const wasActive = this.state.connection.profileId === profileId;
				const previous = this.state.connection;
				const revision = ++this.revision;
				this.patch({
					...wasActive ? { connection: {
						...EMPTY_CONNECTION,
						status: "connecting",
						profileId
					} } : {},
					failure: null
				});
				const outcome = await this.bridge(this.remote.pcDisconnect({ profileId }));
				if (revision !== this.revision || this.disposed) return failed(stale("disconnect"));
				if (!outcome.ok) {
					if (wasActive) this.patch({ connection: {
						...previous,
						error: outcome.failure
					} });
					return this.fail(outcome.failure);
				}
				this.patch({
					profiles: this.state.profiles.map((profile) => profile.profileId === profileId ? {
						...profile,
						status: "disconnected"
					} : profile),
					...wasActive ? { connection: EMPTY_CONNECTION } : {},
					failure: null
				});
				return success(void 0);
			}
			async forgetProfile(profileId) {
				if (!profileId) return this.fail(makeFailure("remote-dev/pc-profile-required", "请选择要移除的主机配置。", null));
				const wasActive = this.state.connection.profileId === profileId;
				const previous = this.state.connection;
				const revision = ++this.revision;
				this.patch({
					...wasActive ? { connection: {
						...EMPTY_CONNECTION,
						status: "connecting",
						profileId
					} } : {},
					failure: null
				});
				const outcome = await this.bridge(this.remote.pcForget({ profileId }));
				if (revision !== this.revision || this.disposed) return failed(stale("forget"));
				if (!outcome.ok) {
					if (wasActive) this.patch({ connection: {
						...previous,
						error: outcome.failure
					} });
					return this.fail(outcome.failure);
				}
				this.patch({
					profiles: this.state.profiles.filter((profile) => profile.profileId !== profileId),
					...wasActive ? { connection: EMPTY_CONNECTION } : {},
					failure: null
				});
				return success(void 0);
			}
			async revokeSelf(profileId = this.state.connection.profileId ?? "") {
				const connection = this.state.connection;
				if (!profileId || connection.profileId !== profileId || connection.status !== "connected" || connection.generation === null) return this.fail(makeFailure("remote-dev/pc-connection-required", "撤销本设备授权前，请先连接并验证对应主机。", null));
				const capturedGeneration = connection.generation;
				const revision = ++this.revision;
				this.patch({
					connection: {
						...EMPTY_CONNECTION,
						status: "connecting",
						profileId
					},
					failure: null
				});
				const outcome = await this.bridge(this.remote.pcRevoke({
					profileId,
					generation: capturedGeneration
				}));
				if (revision !== this.revision || this.disposed) return failed(stale("revoke"));
				if (!outcome.ok) {
					this.patch({ connection: {
						...connection,
						error: outcome.failure
					} });
					return this.fail(outcome.failure);
				}
				this.patch({
					profiles: this.state.profiles.filter((profile) => profile.profileId !== profileId),
					connection: EMPTY_CONNECTION,
					failure: null
				});
				return success(void 0);
			}
			dispose() {
				if (this.disposed) return;
				this.disposed = true;
				this.revision += 1;
				this.previewRequest += 1;
				this.listeners.clear();
			}
			beginConnection(profileId) {
				const revision = ++this.revision;
				this.patch({
					connection: {
						...EMPTY_CONNECTION,
						status: "connecting",
						profileId
					},
					failure: null
				});
				return revision;
			}
			async accept(value, revision, expectedHostId, reconcilePairedProfile = false) {
				const parsed = parseHostInfo(value.hostInfoJson);
				if (!parsed.ok) return this.connectionFailure(parsed.failure);
				if (value.profileId.length === 0 || value.hostId.length === 0 || value.generation.length === 0) return this.connectionFailure(makeFailure("remote-dev/pc-pairing-invalid", "连接响应缺少 profile、host 或 generation 身份。", null));
				if (value.hostId !== expectedHostId) return this.connectionFailure(makeFailure("remote-dev/pc-pairing-invalid", "已验证主机身份与预览或保存的主机不匹配。", {
					expectedHostId,
					actualHostId: value.hostId
				}));
				const hostInfoId = stringOf$1(parsed.value.id);
				if (hostInfoId !== "" && hostInfoId !== expectedHostId) return this.connectionFailure(makeFailure("remote-dev/pc-pairing-invalid", "host.info 中的主机 ID 与连接配置不匹配。", {
					expectedHostId,
					actualHostId: hostInfoId
				}));
				if (revision !== this.revision || this.disposed) {
					this.refreshProfiles();
					return failed(stale("connect response"));
				}
				this.patch({
					connection: {
						status: "connected",
						profileId: value.profileId,
						hostId: value.hostId,
						generation: value.generation,
						hostInfo: parsed.value,
						error: null
					},
					profiles: this.state.profiles.map((profile) => profile.profileId === value.profileId ? {
						...profile,
						status: "connected"
					} : profile),
					failure: null
				});
				if (!reconcilePairedProfile) return success(value);
				const profiles = await this.refreshProfilesAfterPair();
				if (revision !== this.revision || this.disposed) return failed(stale("paired profile reconciliation"));
				if (!profiles.ok) this.patch({ failure: makeFailure("remote-dev/pc-profile-recovery-required", "主机已配对并验证，但无法刷新本机连接列表；请重试刷新以启用原生远程会话。", {
					profileId: value.profileId,
					generation: value.generation
				}) });
				else {
					const saved = profiles.value.find((profile) => profile.profileId === value.profileId);
					if (saved === void 0 || saved.hostId !== value.hostId) this.patch({ failure: makeFailure("remote-dev/pc-profile-recovery-required", "主机已配对并验证，但保存配置未能与当前连接匹配；请刷新配置列表或重新配对。", {
						profileId: value.profileId,
						expectedHostId: value.hostId,
						savedHostId: saved?.hostId ?? null
					}) });
				}
				return success(value);
			}
			async loadProfiles() {
				const outcome = await this.bridge(this.remote.pcProfiles({}));
				if (!outcome.ok) return this.fail(outcome.failure);
				if (this.disposed) return failed(stale("profile list"));
				this.patch({
					profiles: outcome.value.profiles,
					failure: null
				});
				return success(outcome.value.profiles);
			}
			async refreshProfilesAfterPair() {
				const earlier = this.profileRefresh;
				if (earlier !== void 0) await earlier;
				return this.refreshProfiles();
			}
			connectionFailure(failure) {
				const profileId = this.state.connection.profileId;
				this.patch({
					connection: {
						...EMPTY_CONNECTION,
						status: "error",
						profileId,
						error: failure
					},
					failure
				});
				this.refreshProfiles();
				return {
					ok: false,
					failure
				};
			}
			async bridge(promise) {
				try {
					const outcome = await promise;
					return outcome.ok ? success(outcome.value) : {
						ok: false,
						failure: remoteFailure$1(outcome.error)
					};
				} catch (error) {
					return {
						ok: false,
						failure: exceptionFailure(error)
					};
				}
			}
			fail(failure) {
				if (!this.disposed) this.patch({ failure });
				return {
					ok: false,
					failure
				};
			}
			patch(patch) {
				if (this.disposed) return;
				this.state = {
					...this.state,
					...patch
				};
				for (const listener of [...this.listeners]) listener();
			}
		};
		function createPcConnectionController(options) {
			const { remote, ...rest } = options;
			return new PcConnectionModel(remote, rest);
		}
		function success(value) {
			return {
				ok: true,
				value
			};
		}
		function failed(failure) {
			return {
				ok: false,
				failure
			};
		}
		function makeFailure(code, message, details) {
			return {
				code,
				message,
				details
			};
		}
		function stale(operation) {
			return makeFailure("remote-dev/pc-stale-generation", `连接在 ${operation} 完成前已切换；过期结果未覆盖当前连接。`, null);
		}
		function parseHostInfo(json) {
			try {
				const value = JSON.parse(json);
				if (value === null || typeof value !== "object" || Array.isArray(value)) return failed(makeFailure("remote-dev/pc-pairing-invalid", "host.info 不是有效 JSON 对象。", null));
				return success(value);
			} catch {
				return failed(makeFailure("remote-dev/pc-pairing-invalid", "host.info 不是有效 JSON。", null));
			}
		}
		function remoteFailure$1(error) {
			const record = asRecord$2(error);
			const details = record?.details;
			const detailRecord = asRecord$2(details);
			const remoteCode = typeof detailRecord?.remoteCode === "number" ? detailRecord.remoteCode : void 0;
			let remoteData = detailRecord?.dataJson;
			if (typeof remoteData === "string") {
				const rawRemoteData = remoteData;
				try {
					remoteData = JSON.parse(rawRemoteData);
				} catch {
					remoteData = rawRemoteData.slice(0, 4e3);
				}
			}
			return {
				code: stringOf$1(record?.code) || "remote-dev/pc-failed",
				message: stringOf$1(detailRecord?.remoteMessage) || stringOf$1(record?.message) || "PC 连接操作失败。",
				details,
				...remoteCode === void 0 ? {} : {
					remoteCode,
					remoteData
				}
			};
		}
		function exceptionFailure(error) {
			const record = asRecord$2(error);
			return {
				code: stringOf$1(record?.code) || "remote-dev/pc-transport-failed",
				message: stringOf$1(record?.message) || "PC 连接操作失败。",
				details: record?.details ?? null
			};
		}
		function asRecord$2(value) {
			return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
		}
		function stringOf$1(value) {
			return typeof value === "string" ? value : "";
		}
		// packages/perse-remote-dev/src/client/pc-ui/styles.ts
		/** Theme-token styles for the connection panel, emitted in the plugin JS bundle. */
		const PC_CONNECTION_CSS = [
			".pcConnectionSettings{box-sizing:border-box;width:min(100%,820px);height:100%;overflow:auto;margin:0 auto;padding:28px clamp(18px,4vw,42px);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font:13px/1.5 system-ui,-apple-system,sans-serif}",
			".pcConnectionHeader,.pcConnectionSectionHeading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.pcConnectionHeader h1{margin:0;font-size:20px}.pcConnectionHeader p{max-width:620px;margin:6px 0 0}.pcConnectionSettings h2{margin:0;font-size:15px}.pcConnectionSettings h3{margin:0 0 8px;font-size:14px}",
			".pcConnectionMuted,.pcConnectionFootnote{color:var(--dsw-alias-label-tertiary)}.pcConnectionSection{margin:20px 0;padding:16px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}.pcConnectionField{display:flex;flex-direction:column;gap:5px;margin:12px 0}.pcConnectionField>span{color:var(--dsw-alias-label-secondary);font-size:12px}.pcConnectionField textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:9px 10px;font:inherit;resize:vertical;min-height:78px}.pcConnectionSettings :focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}",
			".pcConnectionStatus{display:flex;align-items:center;gap:7px;white-space:nowrap;padding:5px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;color:var(--dsw-alias-label-secondary)}.pcConnectionStatusDot{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-label-tertiary)}.pcConnectionStatus[data-state=connected] .pcConnectionStatusDot{background:var(--dsw-alias-state-success-primary)}.pcConnectionStatus[data-state=connecting] .pcConnectionStatusDot{background:var(--dsw-alias-state-warn-primary)}.pcConnectionStatus[data-state=offline] .pcConnectionStatusDot,.pcConnectionStatus[data-state=error] .pcConnectionStatusDot{background:var(--dsw-alias-state-error-primary)}",
			".pcConnectionBoundary{margin:18px 0;padding:12px 14px;border:1px solid var(--dsw-alias-state-warn-primary);border-left:4px solid var(--dsw-alias-state-warn-primary);border-radius:8px;background:var(--dsw-alias-bg-layer-1)}.pcConnectionBoundary p{margin:4px 0 0;color:var(--dsw-alias-label-secondary)}.pcConnectionPreview,.pcConnectionVerified{margin-top:12px;padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-base)}.pcConnectionPreview dl{display:grid;grid-template-columns:110px minmax(0,1fr);gap:5px 10px;margin:0 0 12px}.pcConnectionPreview dt{color:var(--dsw-alias-label-tertiary)}.pcConnectionPreview dd{margin:0;overflow-wrap:anywhere}.pcConnectionVerified{display:flex;flex-wrap:wrap;gap:8px 18px;color:var(--dsw-alias-label-secondary)}.pcConnectionProfile{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:10px;padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px}.pcConnectionProfileMain{display:flex;min-width:0;flex-direction:column}.pcConnectionProfileMain>span{overflow-wrap:anywhere;color:var(--dsw-alias-label-tertiary);font-size:12px}.pcConnectionActions{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap}.pcConnectionNotice,.pcConnectionError{margin:12px 0;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px}.pcConnectionError{color:var(--dsw-alias-state-error-primary)}.pcConnectionError details{margin-top:8px}.pcConnectionError pre{max-height:180px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}.pcConnectionFootnote{font-size:12px}",
			"@media(max-width:620px){.pcConnectionHeader,.pcConnectionProfile{align-items:stretch;flex-direction:column}.pcConnectionActions{justify-content:flex-start}.pcConnectionSettings{padding:18px 14px}.pcConnectionPreview dl{grid-template-columns:82px minmax(0,1fr)}}"
		].join("");
		// packages/perse-remote-dev/src/client/pc-ui/index.ts
		const PC_CONNECTION_LOCALE = "perse.remote.connection";
		const pcConnectionLocale = {
			zh: {
				panel: "远程连接",
				title: "远程连接",
				intro: "管理远程主机的配对与连接。",
				connected: "已验证连接",
				connecting: "正在验证主机身份…",
				offline: "离线",
				revoked: "授权已撤销",
				error: "连接失败",
				disconnected: "未连接",
				upgradeTitle: "需要升级 DSH",
				upgradeBody: "当前 DSH 核心缺少原生远程会话接口。连接配置仍可使用；升级 DSH 后，远程项目和会话会出现在原生工作区中。",
				uncertainTitle: "有 {count} 次远程会话创建结果未知",
				uncertainBody: "请检查对应主机的会话列表。插件不会自动重试创建，也不会猜测哪条会话由这次操作产生。",
				unknownReceipt: "本地操作核实记录无法读取；请先检查相关主机的会话列表。",
				receiptDetail: "主机 {hostId}，工作区 {workspaceId}，开始时间 {time}",
				thisDevice: "此电脑",
				ackReceipt: "我已检查会话列表；仅清除提醒",
				errorFallback: "操作失败，请重试。",
				operationError: "操作未完成，请重试。",
				verifiedHost: "主机身份已验证",
				connectionDetails: "连接详情",
				hostId: "主机 ID",
				generation: "连接代次（诊断）",
				addHost: "添加远程主机",
				pairingIntro: "从被控主机的 Perse Remote 配对管理页生成链接。预览只在本机解析；确认后才交换一次性凭据并验证主机身份。",
				pairLink: "配对链接",
				pairPlaceholder: "粘贴 persevere://pair#… 链接",
				deviceName: "设备名称",
				preview: "预览配对信息",
				previewCreated: "已生成配对预览。",
				verifyHost: "核对主机信息",
				confirmPairing: "确认并验证主机",
				savedHosts: "已保存的主机",
				refresh: "刷新",
				refreshed: "连接列表已刷新。",
				emptyProfiles: "还没有保存的主机连接。",
				saved: "已保存",
				remoteHost: "远程主机",
				disconnect: "断开",
				connect: "连接并验证",
				disconnectedNotice: "已断开主机。",
				verifiedNotice: "主机身份已验证。",
				revoke: "撤销此设备",
				revokeConfirm: "撤销后，此设备的授权将失效。继续？",
				revokedNotice: "设备授权已撤销。",
				forget: "忘记主机",
				forgetConfirm: "只会移除此设备保存的连接信息，不会撤销主机上的授权。继续？",
				forgotNotice: "已从本机移除此主机。",
				footnote: "主机身份已核对；本地 DSH 会话不受影响。",
				checkedHost: "已验证连接",
				host: "主机",
				address: "地址",
				network: "网络",
				permissions: "权限",
				expires: "有效期",
				diagnostics: "诊断详情",
				previewHost: "主机",
				previewId: "主机 ID",
				networkMode: "网络",
				permissionSummary: "权限",
				legacyImport: "导入旧远程开发配置",
				legacyIntro: "显式预览并导入原 settings.yaml 中的 remote-dev 段。预览只显示字段名，不显示主机或凭据内容；旧文件会完整保留。",
				legacyPreview: "预览旧配置",
				legacyApply: "确认并写入当前 profile",
				legacySource: "来源文件",
				legacyFields: "可导入字段",
				legacyConflicts: "冲突字段",
				legacyUnsupported: "不支持的字段",
				legacyApplied: "旧配置已写入当前 profile。",
				legacySourcesBoth: "找到两个候选文件，请分别选择并预览。",
				legacyNoSource: "原生 profile 目录中没有可导入的旧配置文件。"
			},
			en: {
				panel: "Remote connection",
				title: "Remote connection",
				intro: "Manage pairing and connections to remote hosts.",
				connected: "Verified connection",
				connecting: "Verifying host identity…",
				offline: "Offline",
				revoked: "Authorization revoked",
				error: "Connection failed",
				disconnected: "Not connected",
				upgradeTitle: "DSH upgrade required",
				upgradeBody: "This DSH core does not provide the native remote-session interface. Connection settings remain available; remote projects and sessions will appear in the native workspace after upgrading DSH.",
				uncertainTitle: "{count} remote session creation result(s) are unknown",
				uncertainBody: "Check the session list on the relevant host. The plugin will not retry creation or guess which session came from this operation.",
				unknownReceipt: "The local operation receipt cannot be read. Check the session list on the relevant host first.",
				receiptDetail: "Host {hostId}, workspace {workspaceId}, started {time}",
				thisDevice: "This PC",
				ackReceipt: "I checked the session list; clear this reminder only",
				errorFallback: "The operation failed. Try again.",
				operationError: "The operation did not finish. Try again.",
				verifiedHost: "Host identity verified",
				connectionDetails: "Connection details",
				hostId: "Host ID",
				generation: "Connection generation (diagnostic)",
				addHost: "Add remote host",
				pairingIntro: "Create a link from Perse Remote pairing management on the host. The preview is parsed locally; one-time credentials are exchanged only after confirmation and host identity verification.",
				pairLink: "Pairing link",
				pairPlaceholder: "Paste a persevere://pair#… link",
				deviceName: "Device name",
				preview: "Preview pairing",
				previewCreated: "Pairing preview is ready.",
				verifyHost: "Verify host details",
				confirmPairing: "Confirm and verify host",
				savedHosts: "Saved hosts",
				refresh: "Refresh",
				refreshed: "Connection list refreshed.",
				emptyProfiles: "No saved host connections yet.",
				saved: "Saved",
				remoteHost: "Remote host",
				disconnect: "Disconnect",
				connect: "Connect and verify",
				disconnectedNotice: "Host disconnected.",
				verifiedNotice: "Host identity verified.",
				revoke: "Revoke this device",
				revokeConfirm: "This will invalidate this device authorization. Continue?",
				revokedNotice: "Device authorization revoked.",
				forget: "Forget host",
				forgetConfirm: "This removes the connection saved on this device only; it does not revoke host authorization. Continue?",
				forgotNotice: "Host removed from this device.",
				footnote: "Host identity verified; local DSH sessions are unaffected.",
				checkedHost: "Verified connection",
				host: "Host",
				address: "Address",
				network: "Network",
				permissions: "Permissions",
				expires: "Expires",
				diagnostics: "Diagnostics",
				previewHost: "Host",
				previewId: "Host ID",
				networkMode: "Network",
				permissionSummary: "Permissions",
				legacyImport: "Import legacy remote settings",
				legacyIntro: "Preview and explicitly import the remote-dev section from the original settings.yaml. The preview shows field names only; host values and credentials are not displayed. The source file stays intact.",
				legacyPreview: "Preview legacy settings",
				legacyApply: "Confirm and write to this profile",
				legacySource: "Source file",
				legacyFields: "Importable fields",
				legacyConflicts: "Conflicting fields",
				legacyUnsupported: "Unsupported fields",
				legacyApplied: "Legacy settings were written to this profile.",
				legacySourcesBoth: "Two candidate files were found. Select and preview each explicitly.",
				legacyNoSource: "No legacy settings file was found under the native profile directory."
			}
		};
		const h = react.createElement;
		const css = {
			settings: "pcConnectionSettings",
			header: "pcConnectionHeader",
			muted: "pcConnectionMuted",
			status: "pcConnectionStatus",
			statusDot: "pcConnectionStatusDot",
			boundary: "pcConnectionBoundary",
			notice: "pcConnectionNotice",
			error: "pcConnectionError",
			verified: "pcConnectionVerified",
			section: "pcConnectionSection",
			field: "pcConnectionField",
			preview: "pcConnectionPreview",
			sectionHeading: "pcConnectionSectionHeading",
			profile: "pcConnectionProfile",
			profileMain: "pcConnectionProfileMain",
			actions: "pcConnectionActions",
			footnote: "pcConnectionFootnote"
		};
		const format = (template, values = {}) => template.replace(/\{([^}]+)\}/g, (_match, key) => String(values[key] ?? ""));
		function statusLabel(status, t) {
			switch (status) {
				case "connected": return t("connected");
				case "connecting": return t("connecting");
				case "offline": return t("offline");
				case "revoked": return t("revoked");
				case "error": return t("error");
				default: return t("disconnected");
			}
		}
		function PcConnectionSettings(props) {
			const { controller, t } = props;
			const snapshot = props.useConnection((value) => value);
			const [pairLink, setPairLink] = react.useState("");
			const [deviceName, setDeviceName] = react.useState("");
			const [busy, setBusy] = react.useState(false);
			const [message, setMessage] = react.useState("");
			const [failure, setFailure] = react.useState("");
			const run = async (action, success) => {
				setBusy(true);
				setFailure("");
				setMessage("");
				try {
					const result = await action();
					if (result !== null && typeof result === "object" && "ok" in result && result.ok === false) {
						const issue = "failure" in result ? result.failure : "error" in result ? result.error : void 0;
						const detail = issue !== null && typeof issue === "object" && "message" in issue && typeof issue.message === "string" ? issue.message : t("errorFallback");
						setFailure(detail);
					} else setMessage(success);
				} catch (error) {
					setFailure(error instanceof Error ? error.message : t("operationError"));
				} finally {
					setBusy(false);
				}
			};
			const connected = snapshot.connection.status === "connected" && snapshot.connection.hostInfo !== null && snapshot.connection.generation !== null;
			const preview = snapshot.pairingPreview;
			const activeProfileId = snapshot.connection.profileId;
			const hostInfo = snapshot.connection.hostInfo;
			const confirmedHostName = hostInfo !== null && "hostName" in hostInfo && typeof hostInfo.hostName === "string" ? hostInfo.hostName : hostInfo !== null && "name" in hostInfo && typeof hostInfo.name === "string" ? hostInfo.name : "";
			const button = (label, onClick, variant = "outline", disabled = false) => h(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant,
				size: "sm",
				onClick,
				disabled
			}, label);
			return h("main", {
				className: css.settings,
				"data-pc-connection-settings": "1"
			}, h("style", { "data-pc-connection-styles": "1" }, PC_CONNECTION_CSS), h("header", { className: css.header }, h("div", null, h("h1", null, t("title")), h("p", { className: css.muted }, t("intro"))), h("div", {
				className: css.status,
				"data-state": connected ? "connected" : snapshot.connection.status
			}, h("span", {
				className: css.statusDot,
				"aria-hidden": true
			}), h("span", null, statusLabel(snapshot.connection.status, t)))), snapshot.nativeSessionSupport === "unavailable" ? h("aside", {
				className: css.boundary,
				role: "note",
				"data-pc-native-session-support": snapshot.nativeSessionSupport
			}, h("strong", null, t("upgradeTitle")), h("p", null, t("upgradeBody"))) : null, message ? h("div", {
				className: css.notice,
				role: "status"
			}, message) : null, snapshot.pendingCreations.length > 0 ? h("div", {
				className: css.notice,
				role: "alert",
				"data-pc-creation-uncertain": snapshot.pendingCreations.length
			}, h("strong", null, format(t("uncertainTitle"), { count: snapshot.pendingCreations.length })), h("p", null, t("uncertainBody")), h("ul", null, ...snapshot.pendingCreations.map((item) => h("li", { key: item.operationId }, h("span", null, item.startedAt === 0 ? t("unknownReceipt") : format(t("receiptDetail"), {
				hostId: item.hostId,
				workspaceId: item.workspaceId,
				time: new Date(item.startedAt).toLocaleString()
			})), item.startedAt === 0 ? null : h(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "outline",
				size: "sm",
				onClick: () => controller.acknowledgeCreationReceipt(item.operationId)
			}, t("ackReceipt")))))) : null, failure ? h("div", {
				className: css.error,
				role: "alert"
			}, failure, snapshot.connection.error?.details === void 0 ? null : h("details", null, h("summary", null, t("diagnostics")), h("pre", null, String(snapshot.connection.error.details)))) : null, connected ? h("div", {
				className: css.verified,
				"data-pc-verified-host": snapshot.connection.hostId ?? ""
			}, h("strong", null, confirmedHostName || t("verifiedHost")), h("details", null, h("summary", null, t("connectionDetails")), h("dl", null, h("dt", null, t("hostId")), h("dd", null, snapshot.connection.hostId), h("dt", null, t("generation")), h("dd", null, snapshot.connection.generation)))) : null, h("section", { className: css.section }, h("h2", null, t("addHost")), h("p", { className: css.muted }, t("pairingIntro")), h("label", { className: css.field }, h("span", null, t("pairLink")), h("textarea", {
				value: pairLink,
				rows: 4,
				autoComplete: "off",
				spellCheck: false,
				placeholder: t("pairPlaceholder"),
				onChange: (event) => setPairLink(event.currentTarget.value)
			})), h("label", { className: css.field }, h("span", null, t("deviceName")), h(_deepseek_ai_dsh_client_ui_primitives.Input, {
				value: deviceName,
				maxLength: 100,
				placeholder: t("thisDevice"),
				onChange: (event) => setDeviceName(event.currentTarget.value)
			})), button(t("preview"), () => void run(async () => {
				const outcome = await controller.previewPairing(pairLink);
				if (outcome.ok) setPairLink("");
				return outcome;
			}, t("previewCreated")), "primary", busy || pairLink.trim() === ""), preview === null ? null : h("div", {
				className: css.preview,
				"data-pc-pair-preview": "1"
			}, h("h3", null, t("verifyHost")), h("dl", null, h("dt", null, t("previewHost")), h("dd", null, preview.hostName), h("dt", null, t("previewId")), h("dd", null, preview.hostId), h("dt", null, t("address")), h("dd", null, preview.endpoint), h("dt", null, t("networkMode")), h("dd", null, preview.networkMode), h("dt", null, t("permissionSummary")), h("dd", null, preview.accessSummary), h("dt", null, t("expires")), h("dd", null, new Date(preview.expiresAt).toLocaleString())), button(t("confirmPairing"), () => void run(() => controller.confirmPairing(preview.confirmationId, deviceName || t("thisDevice")), t("verifiedNotice")), "primary", busy))), h("section", { className: css.section }, h("div", { className: css.sectionHeading }, h("h2", null, t("savedHosts")), button(t("refresh"), () => void run(() => controller.refreshProfiles(), t("refreshed")), "outline", busy)), snapshot.profiles.length === 0 ? h("p", { className: css.muted }, t("emptyProfiles")) : null, ...snapshot.profiles.map((profile) => {
				const isVerifiedActive = connected && profile.profileId === activeProfileId;
				const profileStatus = profile.status === "offline" ? t("offline") : profile.status === "revoked" ? t("revoked") : t("saved");
				return h("article", {
					className: css.profile,
					key: profile.profileId,
					"data-pc-profile": profile.profileId
				}, h("div", { className: css.profileMain }, h("strong", null, profile.hostName || t("remoteHost")), h("span", null, profile.endpoint), h("span", null, `${isVerifiedActive ? t("checkedHost") : profileStatus} · ${profile.networkMode}`)), h("div", { className: css.actions }, button(isVerifiedActive ? t("disconnect") : t("connect"), () => void run(() => isVerifiedActive ? controller.disconnectProfile(profile.profileId) : controller.connectProfile(profile.profileId), isVerifiedActive ? t("disconnectedNotice") : t("verifiedNotice")), isVerifiedActive ? "outline" : "primary", busy), button(t("revoke"), () => {
					if (typeof window !== "undefined" && window.confirm(t("revokeConfirm"))) run(() => controller.revokeSelf(profile.profileId), t("revokedNotice"));
				}, "outline", busy || !isVerifiedActive), button(t("forget"), () => {
					if (typeof window !== "undefined" && window.confirm(t("forgetConfirm"))) run(() => controller.forgetProfile(profile.profileId), t("forgotNotice"));
				}, "outline", busy)));
			})), connected ? h("p", { className: css.footnote }, t("footnote")) : null);
		}
		function PcPanelIcon(props) {
			const size = props.size ?? 18;
			return h("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: 1.7,
				"aria-hidden": true
			}, h("rect", {
				x: 4,
				y: 5,
				width: 16,
				height: 14,
				rx: 2
			}), h("path", { d: "M8 9h8M8 13h5M8 17h8" }));
		}
		function LegacyConfigSettings(props) {
			const { remote, t } = props;
			const [preview, setPreview] = react.useState();
			const [busy, setBusy] = react.useState(false);
			const [message, setMessage] = react.useState("");
			const [failure, setFailure] = react.useState("");
			const runPreview = async (selected) => {
				setBusy(true);
				setFailure("");
				setMessage("");
				try {
					const result = await remote.legacyConfigPreview(selected === void 0 ? {} : { source: selected });
					if (!result.ok) {
						setFailure(result.error.message);
						setPreview(void 0);
						return;
					}
					setPreview(result.value);
				} catch (error) {
					setFailure(error instanceof Error ? error.message : t("operationError"));
				} finally {
					setBusy(false);
				}
			};
			const apply = async () => {
				if (preview?.canApply !== true || preview.source === void 0 || preview.sha256 === void 0) return;
				if (typeof window !== "undefined" && !window.confirm(t("legacyApply"))) return;
				setBusy(true);
				setFailure("");
				setMessage("");
				try {
					const result = await remote.legacyConfigApply({
						source: preview.source,
						sha256: preview.sha256
					});
					if (!result.ok) {
						setFailure(result.error.message);
						return;
					}
					setMessage(t("legacyApplied"));
					setPreview(void 0);
				} catch (error) {
					setFailure(error instanceof Error ? error.message : t("operationError"));
				} finally {
					setBusy(false);
				}
			};
			const h = react.createElement;
			const button = (label, click, disabled = false) => h(_deepseek_ai_dsh_client_ui_primitives.Button, {
				variant: "outline",
				size: "sm",
				onClick: click,
				disabled
			}, label);
			const candidateButtons = preview !== void 0 && preview.source === void 0 ? preview.sources.map((item) => button(item, () => {
				runPreview(item);
			}, busy)) : null;
			return h("section", { "data-legacy-settings-import": "1" }, h("h2", null, t("legacyImport")), h("p", null, t("legacyIntro")), message ? h("p", { role: "status" }, message) : null, failure ? h("p", { role: "alert" }, failure) : null, button(t("legacyPreview"), () => {
				setPreview(void 0);
				runPreview(void 0);
			}, busy), candidateButtons, preview?.source === void 0 && preview?.sources.length === 0 ? h("p", null, t("legacyNoSource")) : null, preview?.source === void 0 && (preview?.sources.length ?? 0) > 1 ? h("p", null, t("legacySourcesBoth")) : null, preview?.source !== void 0 ? h("div", { "data-legacy-preview": preview.source }, h("p", null, `${t("legacySource")}: ${preview.sourcePath ?? preview.source}`), h("p", null, `${t("legacyFields")}: ${preview.importableFields.join(", ") || "—"}`), h("p", null, `${t("legacyConflicts")}: ${preview.conflictFields.join(", ") || "0"}`), preview.unsupportedFields.length > 0 ? h("p", { role: "alert" }, `${t("legacyUnsupported")}: ${preview.unsupportedFields.join(", ")}`) : null, button(t("legacyApply"), () => void apply(), busy || !preview.canApply)) : null);
		}
		// node_modules/@deepseek-ai/dsh-typert-protocol/lib/index.js
		/** The one Remote failure class shared by owners, the Gateway, and consumers. */
		/**
		* One Remote call failure: a real Error carrying its stable code and typed
		* details. Owners throw it at the failure point; the Host Gateway encodes it
		* onto the wire unchanged; the Client face rebuilds an instance for the
		* `RemoteResult` error branch, so `throw result.error` keeps throw semantics.
		* Discrimination is always by `code`, never by instanceof.
		*/
		var RemoteError = class extends Error {
			code;
			details;
			/** Structural marker: cross-realm/bundle identification never uses instanceof. */
			isDSHRemoteError = true;
			/**
			* @param code - stable failure code declared in {@link RemoteErrorDetailsMap}.
			* @param message - human diagnostic carried across the wire.
			* @param details - structured payload typed by the code.
			* @param options - standard Error options (`cause` survives in-process only).
			*/
			constructor(code, message, details, options) {
				super(message, options);
				this.code = code;
				this.details = details;
				this.name = "RemoteError";
			}
		};
		// packages/perse-remote-dev/src/client/native-sessions/approval-source.ts
		var PcApprovalSource = class {
			listeners = /* @__PURE__ */ new Set();
			snapshot = {
				pending: [],
				revision: 0
			};
			getSnapshot = () => this.snapshot;
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			upsert(approval) {
				const previous = this.snapshot.pending.filter((item) => item.approvalId !== approval.approvalId);
				this.publish([...previous, approval]);
			}
			resolve(approvalId) {
				const pending = this.snapshot.pending.filter((item) => item.approvalId !== approvalId);
				if (pending.length !== this.snapshot.pending.length) this.publish(pending);
			}
			replaceAll(pending) {
				this.publish([...pending]);
			}
			dispose() {
				this.listeners.clear();
			}
			publish(pending) {
				this.snapshot = {
					pending,
					revision: this.snapshot.revision + 1
				};
				for (const listener of [...this.listeners]) try {
					listener();
				} catch {}
			}
		};
		// packages/perse-remote-dev/src/client/native-sessions/gateway-event-source.ts
		var PcGatewayEventSource = class {
			listeners = /* @__PURE__ */ new Set();
			snapshot = {
				events: [],
				revision: 0
			};
			getSnapshot = () => this.snapshot;
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			append(record) {
				this.snapshot = {
					events: [...this.snapshot.events, record],
					revision: this.snapshot.revision + 1
				};
				for (const listener of [...this.listeners]) try {
					listener();
				} catch {}
			}
			replaceAll(events) {
				this.snapshot = {
					events: [...events],
					revision: this.snapshot.revision + 1
				};
				for (const listener of [...this.listeners]) try {
					listener();
				} catch {}
			}
			dispose() {
				this.listeners.clear();
			}
		};
		// packages/perse-remote-dev/src/client/native-sessions/submission-receipts.ts
		const STORAGE_KEY = "perse-remote-dev.native-submission-receipts.v1";
		const MAX_RECEIPTS = 256;
		const MAX_STORAGE_BYTES = 131072;
		var SubmissionReceiptStore = class {
			storage;
			activeCreationOperations = /* @__PURE__ */ new Set();
			constructor(storage = browserStorage()) {
				this.storage = storage;
			}
			list() {
				if (this.storage === void 0) return [];
				const raw = this.storage.getItem(STORAGE_KEY);
				if (raw === null) return [];
				if (raw.length > MAX_STORAGE_BYTES) throw new Error("Saved remote mutation receipts exceed the safety limit; inspect the remote session list before sending more work.");
				try {
					const value = JSON.parse(raw);
					if (!Array.isArray(value) || value.length > MAX_RECEIPTS || value.some((item) => !isReceipt(item))) throw new Error("Saved remote mutation receipts are invalid; inspect the remote session list before sending more work.");
					return value;
				} catch (error) {
					if (error instanceof Error && error.message.startsWith("Saved remote mutation receipts")) throw error;
					throw new Error("Saved remote mutation receipts could not be read; inspect the remote session list before sending more work.");
				}
			}
			save(receipt) {
				if (this.storage === void 0) throw new Error("Persistent browser storage is unavailable for safe remote prompt delivery.");
				const next = [...this.list().filter((item) => item.kind !== "prompt" || !sameSession(item, receipt)), receipt];
				if (next.length > MAX_RECEIPTS) throw new Error("Too many unresolved remote prompt receipts; reconnect and resolve an earlier prompt first.");
				const encoded = JSON.stringify(next);
				if (encoded.length > MAX_STORAGE_BYTES) throw new Error("Remote prompt receipt storage reached its safety limit.");
				this.storage.setItem(STORAGE_KEY, encoded);
			}
			clear(receipt) {
				if (this.storage === void 0) return;
				const next = this.list().filter((item) => item.kind !== "prompt" || !sameAttempt(item, receipt));
				if (next.length === 0) this.storage.removeItem(STORAGE_KEY);
				else this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
			}
			uncertainFor(receipt) {
				return this.list().find((item) => item.kind === "prompt" && sameSession(item, receipt));
			}
			saveCreation(receipt) {
				if (this.storage === void 0) throw new Error("Persistent browser storage is unavailable for safe remote session creation.");
				const next = [...this.list().filter((item) => item.kind !== "create" || item.operationId !== receipt.operationId), receipt];
				if (next.length > MAX_RECEIPTS) throw new Error("Too many unresolved remote creation receipts; check the remote session list first.");
				const encoded = JSON.stringify(next);
				if (encoded.length > MAX_STORAGE_BYTES) throw new Error("Remote creation receipt storage reached its safety limit.");
				this.storage.setItem(STORAGE_KEY, encoded);
			}
			clearCreation(operationId) {
				this.activeCreationOperations.delete(operationId);
				if (this.storage === void 0) return;
				const next = this.list().filter((item) => item.kind !== "create" || item.operationId !== operationId);
				if (next.length === 0) this.storage.removeItem(STORAGE_KEY);
				else this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
			}
			creationReceipts(profileId) {
				return this.list().filter((item) => item.kind === "create" && !this.activeCreationOperations.has(item.operationId) && (profileId === void 0 || item.profileId === profileId));
			}
			setCreationInFlight(operationId, active) {
				if (active) this.activeCreationOperations.add(operationId);
				else this.activeCreationOperations.delete(operationId);
			}
		};
		const pcSubmissionReceipts = new SubmissionReceiptStore();
		async function prepareSubmissionReceipt(store, identity, requestedMessageId, payloadFingerprintSource) {
			let fingerprint;
			try {
				fingerprint = await promptFingerprint(payloadFingerprintSource);
			} catch {
				return {
					ok: false,
					reason: "fingerprint-unavailable",
					message: "Secure prompt fingerprinting is unavailable."
				};
			}
			let previous;
			try {
				previous = store.uncertainFor(identity);
			} catch {
				return {
					ok: false,
					reason: "storage-unavailable",
					message: "Saved remote mutation receipts cannot be read safely."
				};
			}
			if (previous !== void 0 && previous.fingerprint !== fingerprint) return {
				ok: false,
				reason: "different-uncertain-payload",
				message: "A prior remote prompt has an unknown result."
			};
			const receipt = {
				kind: "prompt",
				...identity,
				clientMessageId: previous?.clientMessageId ?? requestedMessageId,
				fingerprint
			};
			try {
				store.save(receipt);
			} catch {
				return {
					ok: false,
					reason: "storage-unavailable",
					message: "A persistent idempotency receipt could not be saved."
				};
			}
			return {
				ok: true,
				receipt,
				reused: previous !== void 0
			};
		}
		async function promptFingerprint(payload) {
			const cryptoApi = globalThis.crypto;
			if (cryptoApi?.subtle === void 0) throw new Error("Secure prompt fingerprinting is unavailable in this browser.");
			const digest = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(payload));
			return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
		}
		function browserStorage() {
			try {
				return globalThis.localStorage;
			} catch {
				return;
			}
		}
		function isReceipt(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
			const record = value;
			if (record.kind === "create") return [
				"profileId",
				"hostId",
				"workspaceId",
				"operationId"
			].every((key) => typeof record[key] === "string" && record[key].length > 0 && record[key].length <= 512) && typeof record.startedAt === "number" && Number.isFinite(record.startedAt);
			if (record.kind !== "prompt") return false;
			return [
				"profileId",
				"hostId",
				"workspaceId",
				"sessionId",
				"clientMessageId",
				"fingerprint"
			].every((key) => typeof record[key] === "string" && record[key].length > 0 && record[key].length <= 512);
		}
		function sameSession(left, right) {
			return left.profileId === right.profileId && left.hostId === right.hostId && left.workspaceId === right.workspaceId && left.sessionId === right.sessionId;
		}
		function sameAttempt(left, right) {
			return sameSession(left, right) && left.clientMessageId === right.clientMessageId;
		}
		// packages/perse-remote-dev/src/client/native-sessions/submission-echo-ledger.ts
		var SubmissionEchoLedger = class {
			localByRemoteId = /* @__PURE__ */ new Map();
			bind(remoteMessageId, localRequestId) {
				const existing = this.localByRemoteId.get(remoteMessageId);
				if (existing !== void 0) return existing === localRequestId ? void 0 : localRequestId;
				this.localByRemoteId.set(remoteMessageId, localRequestId);
			}
			take(remoteMessageId, fallback) {
				const localRequestId = this.localByRemoteId.get(remoteMessageId) ?? fallback;
				this.localByRemoteId.delete(remoteMessageId);
				return localRequestId;
			}
		};
		// packages/perse-remote-dev/src/client/native-sessions/live-state.ts
		/** Reconcile one live read delta with the authoritative Gateway session status. */
		function reconcileLiveSessionRead(previous, remoteStatus, sourceTypes, hasEvents) {
			let blank = previous.blank;
			let awaitingFirstTurn = previous.awaitingFirstTurn;
			for (const sourceType of sourceTypes) if (sourceType === "turn/start") {
				blank = false;
				awaitingFirstTurn = false;
			} else if (sourceType === "user/message" || sourceType === "assistant/message") blank = false;
			const running = remoteStatus === "running" || remoteStatus === "waitingApproval";
			return {
				state: {
					running,
					blank,
					awaitingFirstTurn
				},
				shouldPublish: hasEvents || running !== previous.running || blank !== previous.blank || awaitingFirstTurn !== previous.awaitingFirstTurn
			};
		}
		// packages/perse-remote-dev/src/client/native-sessions/protocol.ts
		/** Read-side caps match the attachment service defaults and bound untrusted RPC allocation. */
		const MAX_REMOTE_IMAGE_BYTES = 20971520;
		const MAX_REMOTE_IMAGE_DIMENSION = 8192;
		const MAX_REMOTE_IMAGE_PIXELS = 64e6;
		const MAX_REMOTE_IMAGE_BASE64_CHARS = 4 * Math.ceil(MAX_REMOTE_IMAGE_BYTES / 3);
		const MAX_READ_EVENTS = 5e3;
		/**
		* Parse one `session.read` JSON result and validate its session/cursor boundary.
		* The result intentionally distinguishes gateway sequence from the native
		* sequence preserved inside each event payload.
		*/
		function decodePcSessionRead(resultJson, expectedSessionId, afterSequence, allowExpiredBaseline = false) {
			let input;
			try {
				input = JSON.parse(resultJson);
			} catch {
				return failure({
					code: "invalid-json",
					message: "The remote session response was not valid JSON."
				});
			}
			const record = asRecord$1(input);
			if (record === null) return failure({
				code: "invalid-session",
				message: "The remote session response did not contain valid session metadata."
			});
			const session = decodeSession(record.session);
			if (session === null) return failure({
				code: "invalid-session",
				message: "The remote session response did not contain valid session metadata."
			});
			if (session.id !== expectedSessionId) return failure({
				code: "session-mismatch",
				message: "The remote host returned a different session identity."
			});
			if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) return failure({
				code: "invalid-event",
				message: "The requested remote event cursor was invalid."
			});
			if (!Array.isArray(record.events) || !Number.isSafeInteger(record.retentionFloor) || Number(record.retentionFloor) < 0) return failure({
				code: "invalid-event",
				message: "The remote session response had an invalid event window."
			});
			if (record.events.length > MAX_READ_EVENTS) return failure({
				code: "event-limit",
				message: "The remote session response exceeded the protocol event page limit.",
				limit: MAX_READ_EVENTS
			});
			const retentionFloor = Number(record.retentionFloor);
			if (afterSequence + 1 < retentionFloor && !(allowExpiredBaseline && afterSequence === 0)) return failure({
				code: "cursor-expired",
				message: "The requested remote history cursor is no longer retained by the host.",
				retentionFloor,
				afterSequence
			});
			const events = [];
			let previous = afterSequence;
			for (const candidate of record.events) {
				const event = decodeEvent(candidate, expectedSessionId);
				if (event === null || event.sequence <= previous) return failure({
					code: "invalid-event",
					message: "The remote event page contained an invalid or non-monotonic event.",
					...event === null ? {} : { gatewaySequence: event.sequence }
				});
				events.push(event);
				previous = event.sequence;
			}
			return {
				ok: true,
				value: {
					session,
					events,
					retentionFloor
				}
			};
		}
		function decodePcWorkspaceList(resultJson) {
			const parsed = parseResult(resultJson);
			if (!parsed.ok) return parsed;
			const rows = parsed.value.workspaces;
			if (!Array.isArray(rows)) return failure({
				code: "invalid-session",
				message: "The remote host returned an invalid workspace catalog."
			});
			const workspaces = [];
			const ids = /* @__PURE__ */ new Set();
			for (const row of rows) {
				const value = asRecord$1(row);
				if (value === null || !nonEmpty(value.id) || typeof value.name !== "string" || value.path !== void 0 && typeof value.path !== "string" || ids.has(value.id)) return failure({
					code: "invalid-session",
					message: "The remote host returned an invalid workspace row."
				});
				ids.add(value.id);
				workspaces.push({
					id: value.id,
					name: value.name,
					...typeof value.path === "string" ? { path: value.path } : {}
				});
			}
			return {
				ok: true,
				value: workspaces
			};
		}
		function decodePcSessionList(resultJson) {
			const parsed = parseResult(resultJson);
			if (!parsed.ok) return parsed;
			const rows = parsed.value.sessions;
			const nextCursor = parsed.value.nextCursor;
			if (!Array.isArray(rows) || !(nextCursor === null || typeof nextCursor === "string")) return failure({
				code: "invalid-session",
				message: "The remote host returned an invalid session catalog page."
			});
			const sessions = [];
			const ids = /* @__PURE__ */ new Set();
			for (const row of rows) {
				const session = decodeSession(row);
				if (session === null || ids.has(session.id)) return failure({
					code: "invalid-session",
					message: "The remote host returned an invalid or duplicate session row."
				});
				ids.add(session.id);
				sessions.push(session);
			}
			return {
				ok: true,
				value: {
					sessions,
					nextCursor
				}
			};
		}
		function decodePcSessionCreate(resultJson, expectedWorkspaceId) {
			const parsed = parseResult(resultJson);
			if (!parsed.ok) return parsed;
			const session = decodeSession(parsed.value.session);
			if (session === null || session.workspaceId !== expectedWorkspaceId) return failure({
				code: "invalid-session",
				message: "The remote host returned an invalid created session identity."
			});
			return {
				ok: true,
				value: session
			};
		}
		/** Recover native event fields without discarding the original gateway envelope. */
		function nativeEventOf(event) {
			const payload = event.payload;
			const nativeSequence = payload.nativeSequence;
			const sourceType = payload.sourceType;
			if (!Number.isSafeInteger(nativeSequence) || Number(nativeSequence) < 0 || typeof sourceType !== "string" || sourceType.length === 0) return null;
			const data = { ...payload };
			delete data.nativeSequence;
			delete data.sourceType;
			if ((sourceType === "turn/start" || sourceType === "turn/end") && data.status === statusFor(sourceType, payload)) delete data.status;
			const surfaceOp = data.surfaceOp;
			const sourceEventSeqs = data.sourceEventSeqs;
			delete data.surfaceOp;
			delete data.sourceEventSeqs;
			return {
				sessionId: event.sessionId,
				gatewaySequence: event.sequence,
				sourceType,
				nativeSequence: Number(nativeSequence),
				time: Date.parse(event.timestamp),
				data,
				...surfaceOp === void 0 ? {} : { surfaceOp },
				...sourceEventSeqs === void 0 ? {} : { sourceEventSeqs },
				wire: event
			};
		}
		/** Extract admitted attachment references in the same order as the user message. */
		function attachmentRefsOf(data) {
			const content = asRecord$1(data.message)?.content ?? data.content;
			if (!Array.isArray(content)) return [];
			const refs = [];
			for (const blockValue of content) {
				const block = asRecord$1(blockValue);
				const attachment = asRecord$1(block?.attachment);
				if (attachment === null || typeof attachment.attachmentId !== "string" || typeof attachment.bytes !== "number") continue;
				if (block?.type === "image" && typeof attachment.mediaType === "string" && typeof attachment.width === "number" && typeof attachment.height === "number") refs.push(attachment);
				else if (block?.type === "file" && typeof attachment.name === "string") refs.push(attachment);
			}
			return refs;
		}
		/** Validate and decode the canonical `{attachment, data}` image read response. */
		function decodePcImageAttachment(input, requestedAttachmentId) {
			const value = asRecord$1(input);
			const raw = asRecord$1(value?.attachment);
			if (value === null || raw === null || typeof value.data !== "string") throw new Error("The remote image attachment response was malformed.");
			if (raw.attachmentId !== requestedAttachmentId) throw new Error("The remote image attachment ID did not match the request.");
			const mediaType = parseImageMediaType(raw.mediaType);
			if (mediaType === null) throw new Error("The remote image attachment media type was invalid.");
			if (typeof raw.bytes !== "number" || !Number.isSafeInteger(raw.bytes) || raw.bytes < 1 || raw.bytes > 20971520) throw new Error("The remote image attachment byte count was outside the supported range.");
			const dimensions = parseImageDimensions(raw.width, raw.height);
			if (dimensions === null) throw new Error("The remote image attachment dimensions were invalid.");
			let name;
			if (raw.name !== void 0) {
				if (typeof raw.name !== "string" || raw.name.length > 255 || /[\\/\u0000-\u001f\u007f]/.test(raw.name)) throw new Error("The remote image attachment name was invalid.");
				name = raw.name;
			}
			let originalDimensions;
			if (raw.originalDimensions !== void 0) {
				const dimensions = asRecord$1(raw.originalDimensions);
				const parsedDimensions = dimensions === null ? null : parseImageDimensions(dimensions.width, dimensions.height);
				if (parsedDimensions === null) throw new Error("The remote image attachment original dimensions were invalid.");
				originalDimensions = parsedDimensions;
			}
			const data = decodeCanonicalBase64(value.data);
			if (data.byteLength !== raw.bytes) throw new Error("The remote image attachment byte count did not match its data.");
			return {
				attachment: {
					attachmentId: requestedAttachmentId,
					mediaType,
					bytes: raw.bytes,
					width: dimensions.width,
					height: dimensions.height,
					...name === void 0 ? {} : { name },
					...originalDimensions === void 0 ? {} : { originalDimensions }
				},
				data
			};
		}
		function parseImageMediaType(value) {
			switch (value) {
				case "image/png":
				case "image/jpeg":
				case "image/webp":
				case "image/gif": return value;
				default: return null;
			}
		}
		function parseImageDimensions(width, height) {
			if (typeof width !== "number" || typeof height !== "number" || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > MAX_REMOTE_IMAGE_DIMENSION || height > MAX_REMOTE_IMAGE_DIMENSION || width * height > MAX_REMOTE_IMAGE_PIXELS) return null;
			return {
				width,
				height
			};
		}
		function decodeCanonicalBase64(input) {
			if (input.length === 0 || input.length > MAX_REMOTE_IMAGE_BASE64_CHARS || input.length % 4 !== 0) throw new Error("The remote image attachment data was not valid bounded base64.");
			const padding = input.endsWith("==") ? 2 : input.endsWith("=") ? 1 : 0;
			const contentLength = input.length - padding;
			for (let index = 0; index < contentLength; index += 1) {
				const code = input.charCodeAt(index);
				if (!(code >= 65 && code <= 90 || code >= 97 && code <= 122 || code >= 48 && code <= 57 || code === 43 || code === 47)) throw new Error("The remote image attachment data was not valid bounded base64.");
			}
			if (padding === 2 && contentLength % 4 !== 2 || padding === 1 && contentLength % 4 !== 3 || padding === 0 && contentLength % 4 !== 0) throw new Error("The remote image attachment data was not valid bounded base64.");
			if (padding > 0) {
				const sextet = base64Sextet(input.charCodeAt(contentLength - 1));
				if (sextet === -1 || (sextet & (padding === 2 ? 15 : 3)) !== 0) throw new Error("The remote image attachment data was not canonical base64.");
			}
			let binary;
			try {
				binary = atob(input);
			} catch {
				throw new Error("The remote image attachment data was not valid bounded base64.");
			}
			const data = new Uint8Array(binary.length);
			for (let index = 0; index < binary.length; index += 1) data[index] = binary.charCodeAt(index);
			return data;
		}
		function base64Sextet(code) {
			if (code >= 65 && code <= 90) return code - 65;
			if (code >= 97 && code <= 122) return code - 97 + 26;
			if (code >= 48 && code <= 57) return code - 48 + 52;
			if (code === 43) return 62;
			if (code === 47) return 63;
			return -1;
		}
		function statusFor(sourceType, payload) {
			if (sourceType === "turn/start") return "running";
			if (sourceType !== "turn/end") return void 0;
			const reason = asRecord$1(payload.reason)?.kind;
			return reason === "error" ? "error" : reason === "aborted" || reason === "interrupted" ? "interrupted" : "idle";
		}
		function decodeSession(input) {
			const value = asRecord$1(input);
			if (value === null || !nonEmpty(value.id) || !nonEmpty(value.workspaceId) || !nonEmpty(value.provider) || typeof value.title !== "string" || !isSessionStatus(value.status) || !isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt) || typeof value.archived !== "boolean") return null;
			if (value.model !== void 0 && typeof value.model !== "string") return null;
			return {
				id: value.id,
				workspaceId: value.workspaceId,
				provider: value.provider,
				title: value.title,
				status: value.status,
				createdAt: value.createdAt,
				updatedAt: value.updatedAt,
				archived: value.archived,
				...typeof value.model === "string" ? { model: value.model } : {}
			};
		}
		function parseResult(resultJson) {
			try {
				const value = asRecord$1(JSON.parse(resultJson));
				return value === null ? failure({
					code: "invalid-json",
					message: "The remote response was not a JSON object."
				}) : {
					ok: true,
					value
				};
			} catch {
				return failure({
					code: "invalid-json",
					message: "The remote response was not valid JSON."
				});
			}
		}
		function decodeEvent(input, expectedSessionId) {
			const value = asRecord$1(input);
			if (value === null || value.sessionId !== expectedSessionId || !Number.isSafeInteger(value.sequence) || Number(value.sequence) < 1 || typeof value.type !== "string" || value.type.length === 0 || !isIsoDate(value.timestamp)) return null;
			const payload = asRecord$1(value.payload);
			if (payload === null) return null;
			return {
				sessionId: expectedSessionId,
				sequence: Number(value.sequence),
				type: value.type,
				timestamp: value.timestamp,
				payload
			};
		}
		function isSessionStatus(value) {
			return value === "idle" || value === "running" || value === "waitingApproval" || value === "error" || value === "interrupted";
		}
		function isIsoDate(value) {
			return typeof value === "string" && Number.isFinite(Date.parse(value));
		}
		function nonEmpty(value) {
			return typeof value === "string" && value.length > 0;
		}
		function asRecord$1(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
		}
		function failure(error) {
			return {
				ok: false,
				error
			};
		}
		// packages/perse-remote-dev/src/client/native-sessions/session-face.ts
		const MAX_SESSION_EVENTS = 1e5;
		const MAX_SESSION_JOURNAL_BYTES = 33554432;
		const POLL_INTERVAL_MS = 1500;
		const KNOWN_NATIVE_TYPES = /* @__PURE__ */ new Set([
			"agent-preset/selected",
			"agent/inbox/spliced",
			"approval/asked",
			"approval/decided",
			"approval/policy",
			"assistant/attempt",
			"assistant/message",
			"compaction/end",
			"compaction/prune",
			"compaction/start",
			"compaction/summary",
			"command/done",
			"command/run",
			"deliverables/presented",
			"developer/message",
			"feedback/message-delete",
			"feedback/message-put",
			"feedback/record",
			"goal/change",
			"hook/invoked",
			"hook/result",
			"image/offload",
			"job/registered",
			"job/settled",
			"llm/retry",
			"llm/retry-started",
			"model/selection",
			"permission/preset",
			"plan/mode",
			"request/context",
			"request/header",
			"sandbox/mode",
			"schedule/change",
			"session-log-deepseek/delivery-accepted",
			"session/end-seed",
			"session/title",
			"session/title-llm-request",
			"step/end",
			"step/start",
			"subagent/catalog",
			"subagent/descriptor",
			"system/message",
			"team/member",
			"team/message/delivered",
			"team/message/queued",
			"team/task",
			"tool-workflow/agent-end",
			"tool-workflow/agent-start",
			"tool-workflow/run-end",
			"tool-workflow/run-start",
			"tool/call",
			"tool/ptc-dispatch",
			"tool/ptc-dispatch-start",
			"tool/result",
			"turn/end",
			"turn/start",
			"user/message",
			"web/deepseek-search-llm-request",
			"working-directory/change",
			"workspace/changes"
		]);
		/** Native SessionFace backed only by the captured external host generation. */
		var PcNativeSessionFace = class PcNativeSessionFace {
			sessionId;
			remoteSessionId;
			request;
			remote;
			isCurrent;
			onCatalogUpdate;
			onOffline;
			onDisposed;
			projections = new PcProjectionStore();
			eventSource = new _deepseek_ai_dsh_api_session_controller_client.MutableSessionEventSource();
			mutableEvents = this.eventSource;
			approvals = new PcApprovalSource();
			gatewayEvents = new PcGatewayEventSource();
			listeners = /* @__PURE__ */ new Set();
			sourceEntries = /* @__PURE__ */ new Map();
			seenGatewaySequences = /* @__PURE__ */ new Set();
			seenNativeSequences = /* @__PURE__ */ new Set();
			gatewayRecordCount = 0;
			journalBytes = 0;
			pending = [];
			currentSession;
			cursor = 0;
			lastNativeSequence = -1;
			modelSelectionState = {
				lastUsed: null,
				pending: null
			};
			transientCount = 0;
			pollTimer;
			disposed = false;
			polling = false;
			running = false;
			blank = true;
			promptAttempted = false;
			awaitingFirstTurn = false;
			lastAgentError = null;
			openError = null;
			openState = "cold";
			promptError = null;
			pendingRetire = /* @__PURE__ */ new Map();
			submissionEchoes = new SubmissionEchoLedger();
			promptInFlight = false;
			snapshotCache;
			constructor(sessionId, remoteSessionId, request, remote, isCurrent, onCatalogUpdate, onOffline, onDisposed, initialTitle) {
				this.sessionId = sessionId;
				this.remoteSessionId = remoteSessionId;
				this.request = request;
				this.remote = remote;
				this.isCurrent = isCurrent;
				this.onCatalogUpdate = onCatalogUpdate;
				this.onOffline = onOffline;
				this.onDisposed = onDisposed;
				this.projections.set("title", initialTitle ?? remoteSessionId);
				this.snapshotCache = this.buildSnapshot();
				this.request.signal.addEventListener("abort", this.onAbort, { once: true });
				if (this.request.signal.aborted) this.dispose();
			}
			getSnapshot = () => this.snapshotCache;
			subscribe = (listener) => {
				if (this.disposed) return () => void 0;
				this.listeners.add(listener);
				return () => this.listeners.delete(listener);
			};
			beginSubmission(input) {
				const requestId = uuid();
				const pending = {
					requestId,
					placement: this.running ? input.mode === "steer" ? "steering" : "queued" : "transcript",
					time: Date.now(),
					text: input.text,
					attachments: input.attachments
				};
				this.pending = [...this.pending, pending];
				if (input.onRetire !== void 0) this.pendingRetire.set(requestId, input.onRetire);
				this.promptAttempted = true;
				if (this.blank) this.awaitingFirstTurn = true;
				this.publish();
				let abandoned = false;
				return {
					requestId,
					abandon: () => {
						if (abandoned) return;
						abandoned = true;
						this.retireSubmission(requestId, { reason: "failed" });
					}
				};
			}
			async prompt(content, mode, signal, requestId) {
				const requestIdValue = requestId ?? uuid();
				if (mode === "steer") return this.rejectPrompt(requestId, makeRemoteError("remote-dev/pc-native-capability-unavailable", "This remote host supports queued prompts but not steer.", {
					method: "session.prompt",
					capability: "steer"
				}));
				if (signal?.aborted) return this.rejectPrompt(requestId, makeRemoteError("remote-dev/pc-transport-failed", "The remote prompt was cancelled before dispatch.", {
					profileId: this.request.address.backendId,
					method: "session.prompt",
					reason: "aborted before dispatch"
				}));
				if (this.promptInFlight) return this.rejectPrompt(requestId, makeRemoteError("remote-dev/pc-native-session-unavailable", "Another remote prompt is still resolving; wait before submitting again.", { requiredApi: "session.prompt idempotency" }));
				const encoded = encodePrompt(content);
				if (!encoded.ok) return this.rejectPrompt(requestId, makeRemoteError("remote-dev/pc-native-capability-unavailable", encoded.message, {
					method: "session.prompt",
					capability: encoded.capability
				}));
				const receiptBase = {
					profileId: this.request.address.backendId,
					hostId: this.request.address.hostId,
					workspaceId: this.request.address.workspaceId,
					sessionId: this.remoteSessionId
				};
				const prepared = await prepareSubmissionReceipt(pcSubmissionReceipts, receiptBase, requestIdValue, JSON.stringify({
					text: encoded.text,
					attachments: encoded.attachments
				}));
				if (!prepared.ok) return this.rejectPrompt(requestId, makeRemoteError("remote-dev/pc-native-session-unavailable", prepared.message, { requiredApi: prepared.reason }));
				const { receipt } = prepared;
				const remoteRequestId = receipt.clientMessageId;
				const duplicateLocalRequestId = this.submissionEchoes.bind(remoteRequestId, requestIdValue);
				if (duplicateLocalRequestId !== void 0) this.retireSubmission(duplicateLocalRequestId, { reason: "failed" });
				this.promptInFlight = true;
				this.promptAttempted = true;
				this.blank = false;
				this.promptError = null;
				this.publish();
				try {
					const receiptPayload = asRecord(await this.call("session.prompt", {
						sessionId: this.remoteSessionId,
						text: encoded.text,
						clientMessageId: remoteRequestId,
						...encoded.attachments.length > 0 ? { attachments: encoded.attachments } : {}
					}, signal));
					if (receiptPayload?.accepted !== true || typeof receiptPayload.messageId !== "string") throw invalidSession(this.remoteSessionId, "the prompt receipt was malformed");
					pcSubmissionReceipts.clear(receipt);
					return {
						ok: true,
						value: { accepted: true }
					};
				} catch (error) {
					this.promptError = {
						op: "send",
						error: asRemoteFailure(error)
					};
					if (isDefiniteRemoteRejection$1(error)) {
						pcSubmissionReceipts.clear(receipt);
						const localRequestId = this.submissionEchoes.take(remoteRequestId, requestIdValue);
						this.retireSubmission(localRequestId, { reason: "failed" });
						if (requestId !== void 0 && requestId !== localRequestId) this.retireSubmission(requestId, { reason: "failed" });
						if (requestId === void 0) this.publish();
					} else this.publish();
					return {
						ok: false,
						error: asRemoteFailure(error)
					};
				} finally {
					this.promptInFlight = false;
				}
			}
			rejectPrompt(requestId, error) {
				this.promptError = {
					op: "send",
					error
				};
				if (requestId !== void 0) this.retireSubmission(requestId, { reason: "failed" });
				else this.publish();
				return {
					ok: false,
					error
				};
			}
			async readAttachment(attachmentId) {
				try {
					return {
						ok: true,
						value: decodePcImageAttachment(await this.call("session.attachment", {
							sessionId: this.remoteSessionId,
							attachmentId
						}), attachmentId)
					};
				} catch (error) {
					return {
						ok: false,
						error: asRemoteFailure(error)
					};
				}
			}
			async updateQueue(_itemId, _action) {
				return remoteFailure("remote-dev/pc-native-capability-unavailable", "Perse 1.2 does not expose native queue edit/remove operations.", {
					method: "session.updateQueue",
					capability: "queueEdit"
				});
			}
			async cancel() {
				try {
					await this.call("session.interrupt", { sessionId: this.remoteSessionId });
					return {
						ok: true,
						value: { accepted: true }
					};
				} catch (error) {
					this.promptError = {
						op: "stop",
						error: asRemoteFailure(error)
					};
					this.publish();
					return {
						ok: false,
						error: asRemoteFailure(error)
					};
				}
			}
			async respondApproval(approvalId, decision, signal) {
				const pending = this.approvals.getSnapshot().pending.find((item) => item.approvalId === approvalId);
				if (pending === void 0 || !pending.choices.includes(decision)) throw invalidSession(this.remoteSessionId, "the approval is no longer pending on this Session or does not offer that decision");
				await this.call("approval.respond", {
					sessionId: this.remoteSessionId,
					approvalId,
					decision
				}, signal);
			}
			async rename(title) {
				try {
					const acceptedTitle = stringOf(asRecord(asRecord(await this.call("session.rename", {
						sessionId: this.remoteSessionId,
						title
					}))?.session)?.title);
					if (acceptedTitle === void 0) throw invalidSession(this.remoteSessionId, "the host rename receipt did not include the accepted title");
					this.projections.set("title", acceptedTitle);
					return {
						ok: true,
						value: {
							title: acceptedTitle,
							seq: Math.max(0, this.lastNativeSequence)
						}
					};
				} catch (error) {
					return {
						ok: false,
						error: asRemoteFailure(error)
					};
				}
			}
			async loadOlder() {}
			async loadThrough(sequence) {
				if (this.sourceEntries.has(sequence)) return;
				throw makeRemoteError("remote-dev/pc-native-session-invalid", "The requested native sequence is not present in the loaded remote journal.", {
					sessionId: this.remoteSessionId,
					reason: `native sequence ${sequence} is not in the loaded journal`
				});
			}
			async command(_line) {
				return remoteFailure("remote-dev/pc-native-capability-unavailable", "The Perse 1.2 contract does not expose the native slash-command endpoint.", {
					method: "session.command",
					capability: "command"
				});
			}
			async open() {
				if (this.disposed) throw new Error("remote session is disposed");
				this.openState = "loading";
				this.publish();
				try {
					const entries = [];
					let total = 0;
					let firstPage = true;
					while (true) {
						const page = await this.readPage(this.cursor, firstPage);
						this.assertLiveGeneration();
						if (firstPage && page.retentionFloor > 1) this.openError = asRemoteFailure(makeRemoteError("remote-dev/pc-native-history-expired", "The host no longer retains the beginning of this session history; showing the retained portion.", {
							sessionId: this.remoteSessionId,
							afterSequence: 0,
							retentionFloor: page.retentionFloor
						}));
						if (page.events.length === 0) this.cursor = Math.max(this.cursor, page.retentionFloor - 1);
						firstPage = false;
						this.currentSession = page.session;
						this.projections.set("status", { status: page.session.status });
						this.onCatalogUpdate(page.session);
						const mapped = this.mapEvents(page.events);
						entries.push(...mapped);
						total += page.events.length;
						if (total > MAX_SESSION_EVENTS) throw invalidSession(this.remoteSessionId, `history exceeds the ${MAX_SESSION_EVENTS} event safety limit`);
						if (page.events.length > 0) this.cursor = page.events.at(-1).sequence;
						if (page.events.length < 5e3) break;
					}
					if (this.currentSession !== void 0) this.projections.set("title", this.currentSession.title);
					this.mutableEvents.replace(collapseSettledTransients(entries), false);
					this.running = sessionIsRunning(this.currentSession?.status);
					this.blank = !entries.some((entry) => entry.type === "event" && isTurnOrMessageEvent(entry.event.type));
					this.openState = "open";
					this.publish();
					this.schedulePoll();
				} catch (error) {
					this.openState = "error";
					this.openError = asRemoteFailure(error);
					if (isConnectionFailure$1(error)) this.onOffline(error);
					this.publish();
					throw error;
				}
			}
			dispose() {
				if (this.disposed) return;
				this.disposed = true;
				if (this.pollTimer !== void 0) clearTimeout(this.pollTimer);
				this.pollTimer = void 0;
				this.request.signal.removeEventListener("abort", this.onAbort);
				this.approvals.dispose();
				this.gatewayEvents.dispose();
				this.listeners.clear();
				for (const [id, retire] of this.pendingRetire) {
					retire({ reason: "failed" });
					this.pendingRetire.delete(id);
				}
				this.onDisposed?.();
			}
			onAbort = () => {
				this.dispose();
			};
			async readAfterCursor() {
				if (this.disposed || this.polling) return;
				this.polling = true;
				try {
					while (!this.disposed && this.isCurrent()) {
						const page = await this.readPage(this.cursor);
						if (this.disposed || !this.isCurrent() || this.request.signal.aborted) return;
						this.currentSession = page.session;
						this.projections.set("status", { status: page.session.status });
						this.onCatalogUpdate(page.session);
						const entries = this.mapEvents(page.events);
						const liveState = reconcileLiveSessionRead({
							running: this.running,
							blank: this.blank,
							awaitingFirstTurn: this.awaitingFirstTurn
						}, page.session.status, page.events.map((event) => nativeEventOf(event)?.sourceType).filter((sourceType) => sourceType !== void 0), page.events.length > 0);
						this.running = liveState.state.running;
						this.blank = liveState.state.blank;
						this.awaitingFirstTurn = liveState.state.awaitingFirstTurn;
						for (const entry of entries) this.appendEntry(entry);
						this.projections.set("title", page.session.title);
						if (page.events.length > 0) this.cursor = page.events.at(-1).sequence;
						if (liveState.shouldPublish) this.publish();
						if (page.events.length < 5e3) break;
					}
				} catch (error) {
					if (!this.disposed) {
						if (isHistoryExpired(error)) try {
							await this.recoverExpiredHistory(error);
							return;
						} catch (recoveryError) {
							error = recoveryError;
						}
						this.openState = "error";
						this.openError = asRemoteFailure(error);
						if (isConnectionFailure$1(error)) this.onOffline(error);
						this.publish();
					}
				} finally {
					this.polling = false;
				}
			}
			schedulePoll() {
				if (this.disposed || this.request.signal.aborted || !this.isCurrent()) return;
				this.pollTimer = setTimeout(() => {
					this.pollTimer = void 0;
					this.readAfterCursor().finally(() => this.schedulePoll());
				}, POLL_INTERVAL_MS);
			}
			async recoverExpiredHistory(expiredError) {
				const staged = new PcNativeSessionFace(this.sessionId, this.remoteSessionId, this.request, this.remote, this.isCurrent, () => void 0, () => void 0);
				const entries = [];
				let total = 0;
				let firstPage = true;
				try {
					while (true) {
						this.assertLiveGeneration();
						const page = await staged.readPage(staged.cursor, firstPage);
						this.assertLiveGeneration();
						firstPage = false;
						staged.currentSession = page.session;
						staged.projections.set("status", { status: page.session.status });
						staged.projections.set("title", page.session.title);
						entries.push(...staged.mapEvents(page.events, true));
						total += page.events.length;
						if (total > MAX_SESSION_EVENTS) throw invalidSession(this.remoteSessionId, `retained history exceeds ${MAX_SESSION_EVENTS} events`);
						if (page.events.length > 0) staged.cursor = page.events.at(-1).sequence;
						else staged.cursor = Math.max(staged.cursor, page.retentionFloor - 1);
						if (page.events.length < 5e3) break;
					}
				} catch (error) {
					staged.dispose();
					throw error;
				}
				this.sourceEntries.clear();
				for (const [sequence, entry] of staged.sourceEntries) this.sourceEntries.set(sequence, entry);
				this.seenGatewaySequences.clear();
				for (const sequence of staged.seenGatewaySequences) this.seenGatewaySequences.add(sequence);
				this.seenNativeSequences.clear();
				for (const sequence of staged.seenNativeSequences) this.seenNativeSequences.add(sequence);
				this.gatewayRecordCount = staged.gatewayRecordCount;
				this.journalBytes = staged.journalBytes;
				this.transientCount = staged.transientCount;
				this.lastNativeSequence = staged.lastNativeSequence;
				this.cursor = staged.cursor;
				this.currentSession = staged.currentSession;
				this.modelSelectionState = staged.modelSelectionState;
				this.lastAgentError = staged.lastAgentError;
				this.promptError = null;
				this.projections.set("status", { status: staged.currentSession?.status ?? "idle" });
				this.projections.set("title", staged.currentSession?.title ?? this.remoteSessionId);
				this.projections.set("modelSelection", {
					lastUsed: staged.modelSelectionState.lastUsed,
					next: staged.modelSelectionState.pending ?? staged.modelSelectionState.lastUsed
				});
				this.approvals.replaceAll(staged.approvals.getSnapshot().pending);
				this.gatewayEvents.replaceAll(staged.gatewayEvents.getSnapshot().events);
				this.mutableEvents.replace(collapseSettledTransients(entries), false);
				this.running = sessionIsRunning(this.currentSession?.status);
				this.blank = !entries.some((entry) => entry.type === "event" && isTurnOrMessageEvent(entry.event.type));
				this.awaitingFirstTurn = false;
				if (this.currentSession !== void 0) this.onCatalogUpdate(this.currentSession);
				staged.dispose();
				this.openError = asRemoteFailure(expiredError);
				this.openState = "open";
				this.publish();
			}
			async readPage(afterSequence, allowExpiredBaseline = false) {
				const resultJson = await this.call("session.read", {
					sessionId: this.remoteSessionId,
					afterSequence
				}, this.request.signal);
				const decoded = decodePcSessionRead(JSON.stringify(resultJson), this.remoteSessionId, afterSequence, allowExpiredBaseline);
				if (!decoded.ok) {
					if (decoded.error.code === "cursor-expired") throw makeRemoteError("remote-dev/pc-native-history-expired", decoded.error.message, {
						sessionId: this.remoteSessionId,
						afterSequence: decoded.error.afterSequence,
						retentionFloor: decoded.error.retentionFloor
					});
					throw invalidSession(this.remoteSessionId, decoded.error.message);
				}
				return decoded.value;
			}
			assertLiveGeneration() {
				if (this.disposed || !this.isCurrent() || this.request.signal.aborted) throw staleGeneration(this.request.address.backendId, this.request.generation);
			}
			mapEvents(events, stagingRecovery = false) {
				const entries = [];
				for (const wire of events) {
					if (this.seenGatewaySequences.has(wire.sequence)) continue;
					if (this.seenGatewaySequences.size >= MAX_SESSION_EVENTS) throw invalidSession(this.remoteSessionId, `journal exceeds the ${MAX_SESSION_EVENTS} event safety limit`);
					const wireBytes = new TextEncoder().encode(JSON.stringify(wire)).byteLength;
					if (this.journalBytes + wireBytes > MAX_SESSION_JOURNAL_BYTES) throw invalidSession(this.remoteSessionId, `journal exceeds the ${MAX_SESSION_JOURNAL_BYTES}-byte safety limit`);
					this.journalBytes += wireBytes;
					this.seenGatewaySequences.add(wire.sequence);
					if (wire.type === "approval" && wire.payload.nativeSequence === void 0 && wire.payload.sourceType === void 0) {
						this.mapApprovalEvent(wire);
						continue;
					}
					const native = nativeEventOf(wire);
					if (native === null) {
						const transient = transientEventOf(wire, this.sessionId, this.lastNativeSequence, this.transientCount);
						if (transient !== null) {
							this.transientCount += 1;
							entries.push(transient);
							continue;
						}
						this.mapGatewayOnlyEvent(wire);
						continue;
					}
					if (this.seenNativeSequences.has(native.nativeSequence)) continue;
					this.seenNativeSequences.add(native.nativeSequence);
					this.lastNativeSequence = Math.max(this.lastNativeSequence, native.nativeSequence);
					const opaque = !KNOWN_NATIVE_TYPES.has(native.sourceType);
					const entry = {
						type: "event",
						event: opaque ? {
							type: "external/opaque",
							seq: native.nativeSequence,
							time: native.time,
							ignorable: true,
							data: {
								sourceType: native.sourceType,
								remoteSequence: native.gatewaySequence,
								payload: wire.payload,
								...numberOf(native.data.turn) === void 0 ? {} : { turn: numberOf(native.data.turn) },
								...numberOf(native.data.step) === void 0 ? {} : { step: numberOf(native.data.step) }
							},
							...native.surfaceOp === void 0 ? {} : { surfaceOp: native.surfaceOp },
							...Array.isArray(native.sourceEventSeqs) ? { sourceEventSeqs: native.sourceEventSeqs } : {}
						} : {
							type: native.sourceType,
							seq: native.nativeSequence,
							time: native.time,
							data: native.data,
							...native.surfaceOp === void 0 ? {} : { surfaceOp: native.surfaceOp },
							...Array.isArray(native.sourceEventSeqs) ? { sourceEventSeqs: native.sourceEventSeqs } : {}
						}
					};
					this.sourceEntries.set(native.nativeSequence, entry);
					if (!opaque && native.sourceType === "assistant/message") {
						if (stringOf(native.data.messageId) !== void 0) {
							entries.push(entry);
							continue;
						}
					}
					if (native.sourceType === "turn/start") {
						this.running = true;
						this.awaitingFirstTurn = false;
						this.blank = false;
					} else if (native.sourceType === "turn/end") this.running = false;
					if (native.sourceType === "error" || native.sourceType.endsWith("/error")) this.lastAgentError = stringOf(native.data.message) ?? "Remote session reported an error.";
					if (native.sourceType === "session/title" && typeof native.data.title === "string") this.projections.set("title", native.data.title);
					this.foldModelSelection(native.sourceType, native.data);
					if (native.sourceType === "user/message") {
						this.blank = false;
						const rpcId = stringOf(asRecord(native.data.source)?.rpcId) ?? stringOf(native.data.rpcId) ?? "";
						this.promptError = null;
						if (rpcId !== "" && !stagingRecovery) {
							const receipt = pcSubmissionReceipts.uncertainFor({
								profileId: this.request.address.backendId,
								hostId: this.request.address.hostId,
								workspaceId: this.request.address.workspaceId,
								sessionId: this.remoteSessionId
							});
							if (receipt?.clientMessageId === rpcId) pcSubmissionReceipts.clear(receipt);
							const localRequestId = this.submissionEchoes.take(rpcId, rpcId);
							this.retireSubmission(localRequestId, {
								reason: "observed",
								attachments: attachmentRefsOf(native.data)
							});
						}
					}
					entries.push(entry);
				}
				return entries;
			}
			mapApprovalEvent(wire) {
				this.appendGatewayRecord(wire);
				const approvalId = stringOf(wire.payload.approvalId);
				if (approvalId === void 0) return;
				if (wire.payload.resolved === true) {
					this.approvals.resolve(approvalId);
					this.running = sessionIsRunning(this.currentSession?.status);
					this.publish();
					return;
				}
				const choices = Array.isArray(wire.payload.choices) ? wire.payload.choices.filter((choice) => choice === "allowOnce" || choice === "deny") : [];
				if (choices.length === 0 || typeof wire.payload.title !== "string" || typeof wire.payload.detail !== "string") return;
				this.approvals.upsert({
					approvalId,
					title: wire.payload.title,
					detail: wire.payload.detail,
					choices,
					remoteSequence: wire.sequence
				});
				this.running = true;
				this.blank = false;
				this.publish();
			}
			mapGatewayOnlyEvent(wire) {
				this.appendGatewayRecord(wire);
				if (wire.type === "status") {
					const status = stringOf(wire.payload.status);
					if (status === "running" || status === "waitingApproval") this.running = true;
					else if (status === "idle" || status === "error" || status === "interrupted") this.running = false;
					if (status !== void 0) this.projections.set("status", { status });
				} else if (wire.type === "error") this.lastAgentError = stringOf(wire.payload.message) ?? "Remote session reported an error.";
				this.publish();
			}
			appendGatewayRecord(wire) {
				this.gatewayRecordCount += 1;
				if (this.gatewayRecordCount > MAX_SESSION_EVENTS) throw invalidSession(this.remoteSessionId, `gateway journal exceeds the ${MAX_SESSION_EVENTS} event safety limit`);
				this.gatewayEvents.append({
					remoteSequence: wire.sequence,
					event: wire
				});
			}
			foldModelSelection(sourceType, data) {
				if (sourceType === "model/selection") {
					const selected = modelSelectionOf(data);
					if (selected !== null) this.modelSelectionState = {
						...this.modelSelectionState,
						pending: selected
					};
				} else if (sourceType === "request/header") {
					const config = asRecord(asRecord(data.header)?.config);
					const selected = config === null ? null : modelSelectionOf(config);
					if (selected !== null) {
						const pending = sameModel(this.modelSelectionState.pending, selected) ? null : this.modelSelectionState.pending;
						this.modelSelectionState = {
							lastUsed: selected,
							pending
						};
					}
				}
				this.projections.set("modelSelection", {
					lastUsed: this.modelSelectionState.lastUsed,
					next: this.modelSelectionState.pending ?? this.modelSelectionState.lastUsed
				});
			}
			appendEntry(entry) {
				if (entry.type === "event" && (entry.event.type === "assistant/message" || entry.event.type === "assistant/attempt")) {
					const data = asRecord(entry.event.data);
					const attemptId = stringOf(data?.attemptId) ?? stringOf(data?.messageId);
					if (attemptId !== void 0) {
						this.mutableEvents.settleAssistant(attemptId, entry);
						return;
					}
				}
				if (entry.type === "event" && entry.event.type === "turn/end") {
					for (const current of this.eventSource.getSnapshot().entries) if (current.type === "transient") this.mutableEvents.settleAssistant(current.event.data.attemptId);
				}
				this.mutableEvents.append(entry);
			}
			async call(method, params, signal) {
				if (this.disposed || this.request.signal.aborted || !this.isCurrent()) throw staleGeneration(this.request.address.backendId, this.request.generation);
				signal?.throwIfAborted();
				const outcome = await this.remote.pcCall({
					profileId: this.request.address.backendId,
					generation: this.request.generation,
					method,
					paramsJson: JSON.stringify(params)
				}, signal);
				if (!outcome.ok) throw outcome.error;
				let result;
				try {
					result = JSON.parse(outcome.value.resultJson);
				} catch {
					throw invalidSession(this.remoteSessionId, `the ${method} response was invalid JSON`);
				}
				return result;
			}
			retireSubmission(requestId, result) {
				if (requestId === "") return;
				if (this.pending.find((item) => item.requestId === requestId) === void 0) return;
				this.pending = this.pending.filter((item) => item.requestId !== requestId);
				if (this.pending.length === 0 && this.blank) this.awaitingFirstTurn = false;
				const callback = this.pendingRetire.get(requestId);
				this.pendingRetire.delete(requestId);
				callback?.(result);
				this.publish();
			}
			buildSnapshot() {
				return {
					sessionId: this.sessionId,
					pendingSubmissions: this.pending,
					running: this.running,
					subagent: null,
					removed: false,
					openState: this.openState,
					openError: this.openError,
					hasMore: false,
					loadingOlder: false,
					promptError: this.promptError,
					blank: this.blank,
					lastAgentError: this.lastAgentError,
					promptAttempted: this.promptAttempted,
					awaitingFirstTurn: this.awaitingFirstTurn
				};
			}
			publish() {
				this.snapshotCache = this.buildSnapshot();
				for (const listener of [...this.listeners]) try {
					listener();
				} catch {}
			}
		};
		function encodePrompt(parts) {
			const textParts = [];
			const attachments = [];
			for (const part of parts) if (part.type === "text") {
				if (typeof part.text !== "string") return {
					ok: false,
					capability: "prompt",
					message: "The native prompt contained an invalid text part."
				};
				textParts.push(part.text);
			} else if (part.type === "image") {
				if (typeof part.mediaType !== "string" || typeof part.data !== "string") return {
					ok: false,
					capability: "attachments",
					message: "The native image attachment was invalid."
				};
				attachments.push({
					mimeType: part.mediaType,
					data: part.data,
					...typeof part.name === "string" ? { name: part.name } : {}
				});
			} else return {
				ok: false,
				capability: "fileUpload",
				message: "File upload receipts cannot be sent through the current Perse Remote contract."
			};
			return {
				ok: true,
				text: textParts.join(""),
				attachments
			};
		}
		function transientEventOf(wire, clientSessionId, lastNativeSeq, transientCount) {
			if (wire.type !== "assistantDelta" && wire.type !== "thinking") return null;
			const turn = numberOf(wire.payload.turn);
			const step = numberOf(wire.payload.step);
			const attemptId = stringOf(wire.payload.messageId);
			const text = stringOf(wire.payload.text);
			if (turn === void 0 || step === void 0 || attemptId === void 0 || text === void 0) return null;
			return {
				type: "transient",
				event: {
					type: "assistant/live-chunk",
					seq: lastNativeSeq + 1 - 1 / (transientCount + 2),
					time: Date.parse(wire.timestamp),
					data: {
						attemptId,
						turn,
						step,
						chunk: {
							type: wire.type === "thinking" ? "reasoning-delta" : "text-delta",
							text
						}
					},
					remoteSequence: wire.sequence,
					sessionId: clientSessionId
				}
			};
		}
		function remoteFailure(code, message, details) {
			return {
				ok: false,
				error: makeRemoteError(code, message, details)
			};
		}
		function staleGeneration(profileId, generation) {
			return makeRemoteError("remote-dev/pc-generation-stale", "The remote session belongs to an expired connection generation.", {
				profileId,
				expectedGeneration: generation
			});
		}
		function invalidSession(sessionId, reason) {
			return makeRemoteError("remote-dev/pc-native-session-invalid", "The remote native session response was invalid.", {
				sessionId,
				reason
			});
		}
		function asRemoteFailure(error) {
			if (isRemoteError(error)) return error;
			return makeRemoteError("remote-dev/pc-transport-failed", "The remote session request failed.", {
				profileId: "unknown",
				method: "session",
				reason: error instanceof Error ? error.name : "unknown failure"
			});
		}
		function isHistoryExpired(error) {
			return typeof error === "object" && error !== null && error.isDSHRemoteError === true && error.code === "remote-dev/pc-native-history-expired";
		}
		function isRemoteError(error) {
			return typeof error === "object" && error !== null && error.isDSHRemoteError === true && typeof error.code === "string";
		}
		function isConnectionFailure$1(error) {
			if (!isRemoteError(error)) return false;
			return error.code === "remote-dev/pc-transport-failed" || error.code === "remote-dev/pc-generation-stale";
		}
		function isDefiniteRemoteRejection$1(error) {
			if (!isRemoteError(error) || error.code !== "remote-dev/pc-remote-error") return false;
			return typeof asRecord(error.details)?.remoteCode === "number";
		}
		function makeRemoteError(code, message, details) {
			return new RemoteError(code, message, details);
		}
		const makePcRemoteError = makeRemoteError;
		var PcProjectionStore = class {
			values = /* @__PURE__ */ new Map();
			listeners = /* @__PURE__ */ new Map();
			faceOf(key) {
				let face = this.values.get(key);
				if (face !== void 0) return face;
				const listeners = this.listeners.get(key) ?? /* @__PURE__ */ new Set();
				this.listeners.set(key, listeners);
				face = {
					getSnapshot: () => this.snapshots.get(key),
					subscribe: (listener) => {
						listeners.add(listener);
						return () => listeners.delete(listener);
					}
				};
				this.values.set(key, face);
				return face;
			}
			set(key, value) {
				const current = this.faceOf(key);
				if (Object.is(current.getSnapshot(), value)) return;
				this.snapshots.set(key, value);
				const listeners = this.listeners.get(key);
				if (listeners === void 0) return;
				for (const listener of [...listeners]) try {
					listener();
				} catch {}
			}
			snapshots = /* @__PURE__ */ new Map();
		};
		function uuid() {
			const value = globalThis.crypto?.randomUUID?.();
			if (value !== void 0) return value;
			const bytes = /* @__PURE__ */ new Uint8Array(16);
			globalThis.crypto.getRandomValues(bytes);
			bytes[6] = bytes[6] & 15 | 64;
			bytes[8] = bytes[8] & 63 | 128;
			const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
			return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
		}
		function asRecord(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
		}
		function numberOf(value) {
			return typeof value === "number" && Number.isFinite(value) ? value : void 0;
		}
		function modelSelectionOf(value) {
			const provider = stringOf(value.provider);
			const model = stringOf(value.model);
			const reasoningEffort = value.reasoningEffort;
			if (provider === void 0 || provider.length === 0 || model === void 0 || model.length === 0) return null;
			return {
				provider,
				model,
				...typeof reasoningEffort === "string" && reasoningEffort.length > 0 ? { reasoningEffort } : {}
			};
		}
		function sameModel(left, right) {
			return left !== null && left.provider === right.provider && left.model === right.model && left.reasoningEffort === right.reasoningEffort;
		}
		function stringOf(value) {
			return typeof value === "string" ? value : void 0;
		}
		function isTurnOrMessageEvent(type) {
			return type === "turn/start" || type === "user/message" || type === "assistant/message";
		}
		function sessionIsRunning(status) {
			return status === "running" || status === "waitingApproval";
		}
		function collapseSettledTransients(entries) {
			const settled = /* @__PURE__ */ new Set();
			for (const entry of entries) {
				if (entry.type !== "event" || entry.event.type !== "assistant/message" && entry.event.type !== "assistant/attempt") continue;
				const data = asRecord(entry.event.data);
				const attemptId = stringOf(data?.attemptId) ?? stringOf(data?.messageId);
				if (attemptId !== void 0) settled.add(attemptId);
			}
			return entries.filter((entry) => entry.type !== "transient" || !settled.has(stringOf(asRecord(entry.event.data)?.attemptId) ?? ""));
		}
		// packages/perse-remote-dev/src/client/native-sessions/backend.ts
		const MAX_WORKSPACES = 1e3;
		const MAX_SESSIONS = 2e4;
		const MAX_SESSION_PAGES = 1e3;
		/** External IDs are branded strings at compile time and plain strings at runtime. */
		function asExternalId(value) {
			return value;
		}
		var Snapshot = class {
			value;
			listeners = /* @__PURE__ */ new Set();
			constructor(initial) {
				this.value = initial;
			}
			getSnapshot = () => this.value;
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			set(value) {
				this.value = value;
				for (const listener of [...this.listeners]) listener();
			}
		};
		/** One exact verified PC profile generation exposed through DSH's external native-session seam. */
		var PcNativeSessionBackend = class {
			backendId;
			hostId;
			hostName;
			profileName;
			generation;
			capabilities;
			catalog;
			remote;
			hostInfo;
			isCurrent;
			onOffline;
			onCreationReceiptChange;
			blankSessions = /* @__PURE__ */ new Set();
			faces = /* @__PURE__ */ new Map();
			disposed = false;
			refreshFlight;
			constructor(options) {
				this.remote = options.remote;
				this.backendId = asExternalId(options.connection.profileId);
				this.hostId = asExternalId(options.connection.hostId);
				this.hostName = options.profile.hostName;
				this.profileName = options.profile.deviceName;
				this.generation = asExternalId(options.connection.generation);
				this.hostInfo = options.hostInfo;
				this.isCurrent = options.isCurrent;
				this.onOffline = options.onOffline;
				this.onCreationReceiptChange = options.onCreationReceiptChange ?? (() => void 0);
				this.capabilities = capabilitiesOf(options.hostInfo);
				this.catalog = new Snapshot(this.catalogValue("connected", []));
			}
			refresh() {
				this.assertCurrent("workspace.list");
				if (this.refreshFlight !== void 0) return this.refreshFlight;
				const flight = this.refreshCatalog();
				this.refreshFlight = flight;
				flight.then(() => {
					if (this.refreshFlight === flight) this.refreshFlight = void 0;
				}, () => {
					if (this.refreshFlight === flight) this.refreshFlight = void 0;
				});
				return flight;
			}
			async refreshCatalog() {
				try {
					const workspaceValue = decodePcWorkspaceList(await this.call("workspace.list", {}));
					if (!workspaceValue.ok) throw invalidCatalog("workspace.list", workspaceValue.error.message);
					if (workspaceValue.value.length > MAX_WORKSPACES) throw invalidCatalog("workspace.list", `workspace count exceeds ${MAX_WORKSPACES}`);
					const workspaces = [];
					let totalSessions = 0;
					for (const workspace of workspaceValue.value) {
						const sessions = [];
						let cursor = null;
						const seenCursors = /* @__PURE__ */ new Set();
						let pages = 0;
						while (true) {
							pages += 1;
							if (pages > MAX_SESSION_PAGES) throw invalidCatalog("session.list", `workspace pagination exceeds ${MAX_SESSION_PAGES} pages`);
							const result = decodePcSessionList(await this.call("session.list", {
								workspaceId: workspace.id,
								archived: false,
								...cursor === null ? {} : { cursor }
							}));
							if (!result.ok) throw invalidCatalog("session.list", result.error.message);
							for (const session of result.value.sessions) {
								if (session.workspaceId !== workspace.id) throw invalidCatalog("session.list", "host returned a session outside the requested workspace");
								sessions.push(session);
								totalSessions += 1;
								if (totalSessions > MAX_SESSIONS) throw invalidCatalog("session.list", `session count exceeds ${MAX_SESSIONS}`);
							}
							const next = result.value.nextCursor;
							if (next === null) break;
							if (seenCursors.has(next)) throw invalidCatalog("session.list", "host repeated a pagination cursor");
							seenCursors.add(next);
							cursor = next;
						}
						workspaces.push({
							id: asExternalId(workspace.id),
							name: workspace.name,
							...workspace.path === void 0 ? {} : { path: workspace.path },
							sessions: sessions.map((session) => this.catalogRow(session))
						});
					}
					this.catalog.set(this.catalogValue("connected", workspaces));
				} catch (error) {
					if (isConnectionFailure(error)) {
						this.catalog.set(this.catalogValue("offline", this.catalog.getSnapshot().workspaces));
						this.onOffline(error);
					}
					throw error;
				}
			}
			async createSession(request) {
				this.assertCurrent("session.create");
				if (request.signal.aborted) throw request.signal.reason;
				if (request.address.backendId !== this.backendId || request.address.hostId !== this.hostId) throw staleBackend(this.backendId, this.generation);
				if (!this.catalog.getSnapshot().workspaces.some((item) => item.id === request.address.workspaceId)) throw invalidCatalog("session.create", "workspace is not present in the verified host catalog");
				if (request.options.agentPreset !== void 0) throw makePcRemoteError("remote-dev/pc-native-capability-unavailable", "This Perse 1.2 contract does not expose remote Agent preset selection.", {
					method: "session.create(agentPreset)",
					capability: "agentPreset"
				});
				const provider = request.options.provider ?? defaultProviderOf(this.hostInfo);
				if (provider === void 0) throw makePcRemoteError("remote-dev/pc-native-capability-unavailable", "The verified host did not advertise an available provider.", {
					method: "session.create",
					capability: "providers"
				});
				const operationId = createOperationId();
				const creationReceipt = {
					kind: "create",
					profileId: this.backendId,
					hostId: this.hostId,
					workspaceId: request.address.workspaceId,
					operationId,
					startedAt: Date.now()
				};
				try {
					pcSubmissionReceipts.saveCreation(creationReceipt);
				} catch {
					throw makePcRemoteError("remote-dev/pc-native-session-unavailable", "The browser could not persist a session-creation receipt, so the remote operation was not sent.", { requiredApi: "persistent browser storage" });
				}
				pcSubmissionReceipts.setCreationInFlight(operationId, true);
				this.updateCreationWarning();
				this.onCreationReceiptChange();
				try {
					const decoded = decodePcSessionCreate(await this.call("session.create", {
						workspaceId: request.address.workspaceId,
						provider,
						...request.options.model === void 0 ? {} : { model: request.options.model }
					}, request.signal), request.address.workspaceId);
					if (!decoded.ok) throw invalidCatalog("session.create", decoded.error.message);
					pcSubmissionReceipts.clearCreation(operationId);
					this.blankSessions.add(decoded.value.id);
					return asExternalId(decoded.value.id);
				} catch (error) {
					if (isNoDispatchFailure(error) || isDefiniteRemoteRejection(error)) pcSubmissionReceipts.clearCreation(operationId);
					throw error;
				} finally {
					pcSubmissionReceipts.setCreationInFlight(operationId, false);
					this.updateCreationWarning();
					this.onCreationReceiptChange();
				}
			}
			openSession(request) {
				if (this.disposed || !this.isCurrent() || request.generation !== this.generation || request.address.backendId !== this.backendId || request.address.hostId !== this.hostId) throw staleBackend(this.backendId, this.generation);
				const face = new PcNativeSessionFace(request.sessionId, request.address.sessionId, request, this.remote, () => !this.disposed && this.isCurrent() && request.generation === this.generation, (session) => this.updateSession(request.address.workspaceId, session), (reason) => this.markOffline(reason), () => {
					if (this.faces.get(request.address.sessionId) === face) this.faces.delete(request.address.sessionId);
				}, this.catalog.getSnapshot().workspaces.find((item) => item.id === request.address.workspaceId)?.sessions.find((item) => item.id === request.address.sessionId)?.title);
				this.faces.set(request.address.sessionId, face);
				return {
					session: face,
					eventSource: face.eventSource,
					approvals: face.approvals,
					gatewayEvents: face.gatewayEvents,
					ready: face.open(),
					dispose: () => face.dispose()
				};
			}
			async respondApproval(request) {
				this.assertCurrent("approval.respond");
				if (request.signal.aborted) throw request.signal.reason;
				if (request.address.backendId !== this.backendId || request.address.hostId !== this.hostId) throw staleBackend(this.backendId, this.generation);
				const face = this.faces.get(request.address.sessionId);
				if (face === void 0) throw invalidCatalog("approval.respond", "the addressed native session is not retained");
				await face.respondApproval(request.approvalId, request.decision, request.signal);
			}
			setOffline(reason) {
				if (this.disposed) return;
				this.catalog.set(this.catalogValue("offline", this.catalog.getSnapshot().workspaces));
				if (reason !== void 0) this.onOffline(reason);
			}
			refreshWarnings() {
				if (!this.disposed) this.updateCreationWarning();
			}
			dispose() {
				if (this.disposed) return;
				this.disposed = true;
				for (const face of this.faces.values()) face.dispose();
				this.faces.clear();
			}
			async call(method, params, signal) {
				this.assertCurrent(method);
				signal?.throwIfAborted();
				const outcome = await this.remote.pcCall({
					profileId: this.backendId,
					generation: this.generation,
					method,
					paramsJson: JSON.stringify(params)
				}, signal);
				if (!outcome.ok) throw outcome.error;
				return outcome.value.resultJson;
			}
			assertCurrent(method) {
				if (this.disposed || !this.isCurrent()) throw staleBackend(this.backendId, this.generation);
				if (this.catalog.getSnapshot().status === "offline") throw makePcRemoteError("remote-dev/pc-transport-failed", "The remote host is offline.", {
					profileId: this.backendId,
					method,
					reason: "backend offline"
				});
			}
			markOffline(reason) {
				this.setOffline(reason);
			}
			creationWarning() {
				let count;
				try {
					count = pcSubmissionReceipts.creationReceipts(this.backendId).filter((receipt) => receipt.hostId === this.hostId).length;
				} catch {
					return "本地操作核实记录无法读取。请先检查此主机的会话列表，再继续创建会话。";
				}
				return count === 0 ? void 0 : `有 ${count} 次远程会话创建结果未知，请检查此主机的会话列表。系统不会自动重试或猜测会话归属。`;
			}
			catalogValue(status, workspaces) {
				const warning = this.creationWarning();
				return {
					status,
					workspaces,
					...warning === void 0 ? {} : { warning }
				};
			}
			updateCreationWarning() {
				const current = this.catalog.getSnapshot();
				this.catalog.set(this.catalogValue(current.status, current.workspaces));
			}
			catalogRow(session) {
				return {
					id: asExternalId(session.id),
					title: session.title,
					updatedAt: Date.parse(session.updatedAt),
					running: session.status === "running" || session.status === "waitingApproval",
					blank: this.blankSessions.has(session.id)
				};
			}
			updateSession(workspaceId, session) {
				const workspaces = this.catalog.getSnapshot().workspaces.map((workspace) => {
					if (workspace.id !== workspaceId) return workspace;
					const sessions = workspace.sessions.some((item) => item.id === session.id) ? workspace.sessions.map((item) => item.id === session.id ? this.catalogRow(session) : item) : [...workspace.sessions, this.catalogRow(session)];
					return {
						...workspace,
						sessions
					};
				});
				this.catalog.set({
					...this.catalog.getSnapshot(),
					workspaces
				});
			}
		};
		function capabilitiesOf(hostInfo) {
			const methods = new Set(Array.isArray(hostInfo.capabilities) ? hostInfo.capabilities.filter((item) => typeof item === "string") : []);
			const sessionSupport = methods.has("sessions");
			return {
				prompt: methods.has("prompt"),
				queue: methods.has("queue") && methods.has("prompt"),
				queueEdit: false,
				steer: false,
				cancel: methods.has("interrupt"),
				rename: sessionSupport,
				readAttachment: methods.has("attachments"),
				fileUpload: false,
				modelSelection: false,
				approvalActions: methods.has("approvals"),
				command: false
			};
		}
		function defaultProviderOf(hostInfo) {
			if (!Array.isArray(hostInfo.providers)) return void 0;
			const providers = hostInfo.providers.filter((value) => typeof value === "object" && value !== null && !Array.isArray(value));
			const selected = providers.find((provider) => provider.available === true && typeof provider.id === "string" && provider.id === "dsh") ?? providers.find((provider) => provider.available === true && typeof provider.id === "string");
			return typeof selected?.id === "string" ? selected.id : void 0;
		}
		function invalidCatalog(method, reason) {
			return makePcRemoteError("remote-dev/pc-native-session-invalid", `Remote ${method} did not return a valid catalog.`, {
				sessionId: method,
				reason
			});
		}
		function staleBackend(profileId, generation) {
			return makePcRemoteError("remote-dev/pc-generation-stale", "The external session backend generation is no longer active.", {
				profileId,
				expectedGeneration: generation
			});
		}
		function isConnectionFailure(error) {
			return typeof error === "object" && error !== null && error.isDSHRemoteError === true && ["remote-dev/pc-transport-failed", "remote-dev/pc-generation-stale"].includes(String(error.code));
		}
		function isDefiniteRemoteRejection(error) {
			if (typeof error !== "object" || error === null || error.isDSHRemoteError !== true || error.code !== "remote-dev/pc-remote-error") return false;
			const details = error.details;
			return typeof details === "object" && details !== null && typeof details.remoteCode === "number";
		}
		function isNoDispatchFailure(error) {
			return typeof error === "object" && error !== null && error.isDSHRemoteError === true && ["remote-dev/pc-generation-stale", "remote-dev/pc-no-dispatch"].includes(String(error.code));
		}
		function createOperationId() {
			return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
		}
		// packages/perse-remote-dev/src/client/native-sessions/registry-compat.ts
		/** Runtime feature detection for old DSH builds that expose ISessions only. */
		function hasExternalSessionsApi(value) {
			if (typeof value !== "object" || value === null) return false;
			const registry = value;
			return [
				"registerExternalBackend",
				"createExternalSession",
				"respondExternalApproval",
				"externalAddressOf",
				"externalIdentityOf",
				"retain",
				"using"
			].every((method) => typeof registry[method] === "function") && isObservable(registry.externalCatalog) && isObservable(registry.retainedBindings);
		}
		function isObservable(value) {
			if (typeof value !== "object" || value === null) return false;
			const observable = value;
			return typeof observable.getSnapshot === "function" && typeof observable.subscribe === "function";
		}
		// packages/perse-remote-dev/src/client/native-sessions/integration.ts
		/** Connects the settings controller to DSH's optional native external-session registry. */
		var PcNativeSessionIntegration = class {
			sessions;
			controller;
			remote;
			backend;
			unregister;
			activeProfileId;
			attemptedRecovery = /* @__PURE__ */ new Set();
			disposed = false;
			stopController;
			constructor(options) {
				const supported = hasExternalSessionsApi(options.sessions);
				this.sessions = supported ? options.sessions : void 0;
				this.controller = options.controller;
				this.remote = options.remote;
				this.controller.setNativeSessionSupport(supported ? "available" : "unavailable");
				this.refreshPendingCreationWarning();
				this.controller.setCreationReceiptAcknowledger((operationId) => this.acknowledgeCreation(operationId));
				this.stopController = this.controller.subscribe(() => this.sync(this.controller.getSnapshot()));
				if (supported) this.restoreConnectedProfiles();
			}
			dispose() {
				if (this.disposed) return;
				this.disposed = true;
				this.controller.setCreationReceiptAcknowledger(() => void 0);
				this.stopController();
				this.unregister?.();
				this.unregister = void 0;
				this.backend?.dispose();
				this.backend = void 0;
			}
			async restoreConnectedProfiles() {
				const profiles = await this.controller.refreshProfiles();
				if (this.disposed || !profiles.ok) return;
				for (const profile of profiles.value) {
					if (profile.status !== "connected" || this.attemptedRecovery.has(profile.profileId)) continue;
					this.attemptedRecovery.add(profile.profileId);
					if (!(await this.controller.connectProfile(profile.profileId)).ok) continue;
				}
			}
			sync(snapshot) {
				if (this.disposed || this.sessions === void 0) return;
				const connection = snapshot.connection;
				if (connection.status === "connected" && connection.profileId !== null && connection.hostId !== null && connection.generation !== null && connection.hostInfo !== null) {
					const profile = snapshot.profiles.find((item) => item.profileId === connection.profileId);
					if (profile === void 0) return;
					if (this.backend?.generation === connection.generation && this.backend.backendId === connection.profileId) return;
					this.install(profile, {
						profileId: connection.profileId,
						hostId: connection.hostId,
						generation: connection.generation,
						hostInfoJson: JSON.stringify(connection.hostInfo)
					});
					return;
				}
				if (this.activeProfileId !== void 0) {
					if (!snapshot.profiles.some((profile) => profile.profileId === this.activeProfileId)) {
						this.unregister?.();
						this.unregister = void 0;
						this.backend?.dispose();
						this.backend = void 0;
						this.activeProfileId = void 0;
					} else this.backend?.setOffline();
				}
			}
			install(profile, connection) {
				if (this.sessions === void 0 || this.disposed) return;
				let parsed;
				try {
					const value = JSON.parse(connection.hostInfoJson);
					if (typeof value !== "object" || value === null || Array.isArray(value)) return;
					parsed = value;
				} catch {
					return;
				}
				this.unregister?.();
				this.backend?.dispose();
				const capturedProfileId = connection.profileId;
				const capturedGeneration = connection.generation;
				const backend = new PcNativeSessionBackend({
					remote: this.remote,
					profile,
					connection,
					hostInfo: parsed,
					isCurrent: () => {
						const current = this.controller.getSnapshot().connection;
						return current.status === "connected" && current.profileId === capturedProfileId && current.generation === capturedGeneration && current.hostId === connection.hostId;
					},
					onOffline: (reason) => this.controller.markConnectionOffline(capturedProfileId, capturedGeneration, reason),
					onCreationReceiptChange: () => this.refreshPendingCreationWarning()
				});
				this.backend = backend;
				this.activeProfileId = connection.profileId;
				this.unregister = this.sessions.registerExternalBackend(backend);
				backend.refresh().catch(() => void 0);
			}
			refreshPendingCreationWarning() {
				try {
					this.controller.setPendingCreations(pcSubmissionReceipts.creationReceipts().map(({ profileId, hostId, workspaceId, operationId, startedAt }) => ({
						profileId,
						hostId,
						workspaceId,
						operationId,
						startedAt
					})));
				} catch {
					this.controller.setPendingCreations([{
						profileId: "unknown",
						hostId: "unknown",
						workspaceId: "unknown",
						operationId: "receipt-storage-unreadable",
						startedAt: 0
					}]);
				}
			}
			acknowledgeCreation(operationId) {
				if (this.disposed) return;
				try {
					pcSubmissionReceipts.clearCreation(operationId);
				} catch {
					return;
				}
				this.backend?.refreshWarnings();
				this.refreshPendingCreationWarning();
			}
		};
		// packages/perse-remote-dev/src/client/index.ts
		const PC_PANEL = "perse-remote-connection";
		const LOG = "[perse-remote-dev]";
		/** Assembly row: mount the generated local owner Remote namespace first. */
		const inject = ["remote"];
		async function apply(ctx) {
			const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE);
			ctx.plugin({
				name: "remote-dev-client/connection-settings",
				inject: [
					"slots",
					"locale",
					"remote.remoteDev",
					"sessions"
				],
				apply: applyPcUi
			});
			console.log(LOG, "PC connection settings mounted");
			return async () => {
				await disposeRemote();
			};
		}
		function applyPcUi(ctx) {
			const remote = ctx.remote.remoteDev;
			const controller = createPcConnectionController({ remote });
			const t = ctx.locale.bind(PC_CONNECTION_LOCALE);
			ctx.effect(() => ctx.locale.register(PC_CONNECTION_LOCALE, pcConnectionLocale), "remote connection dictionaries");
			const nativeSessions = new PcNativeSessionIntegration({
				sessions: ctx.get("sessions"),
				controller,
				remote
			});
			if (controller.getSnapshot().nativeSessionSupport === "unavailable") controller.refreshProfiles();
			ctx.slots.inject("main", () => ctx.slots.register({
				name: "main",
				key: PC_PANEL,
				locale: PC_CONNECTION_LOCALE,
				inject: () => ({
					controller,
					hooks: { connection: controller }
				})
			}, PcConnectionSettings));
			ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
				name: "sidebar.panellist",
				id: PC_PANEL,
				order: 4,
				label: () => t("panel")
			}, PcPanelIcon));
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "remote-dev-legacy-import",
				order: 25,
				label: () => t("legacyImport"),
				locale: PC_CONNECTION_LOCALE,
				inject: () => ({ remote })
			}, LegacyConfigSettings));
			ctx.effect(() => () => {
				controller.dispose();
				nativeSessions.dispose();
			}, "remote connection settings controller");
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
