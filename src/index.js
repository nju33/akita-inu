const pupa = require('pupa');

/**
 * @typedef {Object} Config
 * @property {Object.<string, Target>} Config.targets それぞれ設定
 */
/**
 * @typedef {Object} Target
 * @property {string} Target.base bundle先のブランチ名
 * @property {string} [Target.commit_message='Merge branch {triggered_branch} into {base_branch}'] マージコミット時のテンプレート
 * @property {string} [Target.pull_request_title='{triggered_branch}'] プルリクのタイトル
 * @property {string} [Target.pull_request_body=''] プルリクのタイトル
 */

class Helper {
	constructor(context) {
		this.context = context;
	}

	async existsBranch(branchName) {
		return this.context.github.repos
			.getBranch(this.context.repo({branch: `bundle/${branchName}`}))
			.then(() => true)
			.catch(() => false);
	}

	async getBranch(branchName) {
		return this.context.github.repos.getBranch(
			this.context.repo({branch: branchName})
		);
	}

	async createBranch(baseBranchName, branchName) {
		const {data: branch} = await this.getBranch(baseBranchName);

		await this.context.github.gitdata.createReference(
			this.context.repo({
				ref: `refs/heads/bundle/${branchName}`,
				sha: branch.commit.sha
			})
		);
	}
}

const defaultConfig = {
	// eslint-disable-next-line camelcase
	commit_message: 'Merge branch {triggered_branch} into {base_branch}',
	// eslint-disable-next-line camelcase
	pull_request_title: '{triggered_branch}',
	// eslint-disable-next-line camelcase
	pull_request_body: ''
};

/**
 * This is the entry point for your Probot App.
 * @param {import('probot').Application} app - Probot's Application class.
 */
module.exports = app => {
	/**
   * `push`イベントが`created`だった時のみ
   *
   * 例えば、ブランチが`foo/bar`だった時。
   * `config.target.foo`が存在すれば、まず`bundle/foo`がないかチェック。
   * 無ければ`bundle/foo`ブランチを作成し、そこへ`foo/bar`をマージする。
   * もし、`bundle/foo`のプルリクがない場合は、プルリクを建てる。
   */
	app.on('push', async context => {
		if (!context.payload.created) {
			return;
		}

		const {ref} = context.payload.ref;
		const bundlingBranchName = ref.replace('refs/heads/', '').split('/')[0];

		/**
     * @type {Config}
     */
		const config = await context.config('akita-inu.yml', {
			targets: {}
		});
		Object.keys(config.targets).forEach(key => {
			config.targets[key] = {...defaultConfig, ...config.targets[key]};
		});

		if (config.targets[bundlingBranchName] === undefined) {
			return;
		}
		if (config.targets[bundlingBranchName].base === undefined) {
			app.log.error(`base prop do not exists in the ${bundlingBranchName}`);
		}

		const helper = new Helper(context);

		const {data: triggeredBranch} = await context.github.repos.getBranch(
			context.repo({branch: ref})
		);

		if (!(await helper.existsBranch(bundlingBranchName))) {
			await helper.createBranch(
				config.targets[bundlingBranchName].base,
				bundlingBranchName
			);
		}
		const {data: bundlingBranch} = await helper.getBranch(
			`bundle/${bundlingBranchName}`
		);

		if (triggeredBranch.commit.sha !== bundlingBranch.commit.sha) {
			await context.github.repos.merge(
				context.repo({
					base: `refs/heads/${bundlingBranch.name}`,
					head: triggeredBranch.commit.sha,
					// eslint-disable-next-line camelcase
					commit_message: pupa(
						config.targets[bundlingBranchName].commit_message,
						{
							// eslint-disable-next-line camelcase
							triggered_branch: bundlingBranchName,
							// eslint-disable-next-line camelcase
							base_branch: config.targets[bundlingBranchName].base
						}
					)
				})
			);
		}

		try {
			await context.github.pullRequests.create(
				context.repo({
					title: pupa(config.targets[bundlingBranchName].pull_request_title, {
						// eslint-disable-next-line camelcase
						triggered_branch: config.targets[bundlingBranchName].pull_request_title,
						// eslint-disable-next-line camelcase
						base_branch: config.targets[bundlingBranchName].base
					}),
					body: config.targets[bundlingBranchName].pull_request_body,
					head: `refs/heads/${bundlingBranch.name}`,
					base: `refs/heads/${config.targets[bundlingBranchName].base}`
				})
			);
		} catch (_) {
			app.log('pull request was already exists');
		}
	});
};
