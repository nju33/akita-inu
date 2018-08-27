/**
 * This is the entry point for your Probot App.
 * @param {import('probot').Application} app - Probot's Application class.
 */
module.exports = app => {
  // Your code here
  app.log('Yay, the app was loaded!');

  app.on('issues.opened', async context => {
    const issueComment = context.issue({
      body: 'Thanks for opening this issue!'
    });
    return context.github.issues.createComment(issueComment);
  });

  app.on('push', async context => {
    // const issueComment = context.issue({ body: 'Thanks for opening this issue!' })
    // console.log(context.payload);

    console.log('PAYLOAD:');
    console.log(context.payload);
    // そのままのブランチ名
    const ref = context.payload.ref;
    const baseRef = context.payload.base_ref;
    const repo = context.payload.repository;

    app.log.debug({ref}, 'ref value');
    if (ref.indexOf('refs/heads/') === -1) {
      app.log('ref did not matches `refs/heads/`');
      return;
    }

    if (!/^test/.test(ref.replace('refs/heads/', ''))) {
      return;
    }

    // triggeredBranch.name
    // triggeredBranch.commmit.sha
    const triggeredBranch = await context.github.repos.getBranch(
      context.repo({branch: ref})
    );
    console.log({
      name: triggeredBranch.name,
      commit: triggeredBranch.commit
    });

    // const branch = ref.match(/[^/]+$/)[0];
    const branch = 'test';
    await context.github.repos
      .getBranch(context.repo({branch}))
      .catch(async () => {
        app.log(`${branch} does not exists. so to create ${branch}`);
        const {data} = await context.github.repos.getBranch(
          context.repo({branch: 'master'})
        );
        console.log({
          name: data.name,
          commit: data.commit,
        })
        return data;
      })
      .then(async ({name, commit}) => {
        // app.log.debug(branch, 'master branch');
        // app.log(`to create branch`);
        // リファレンスがあったら？
        const a = await context.github.gitdata.createReference(
        // const a = await context.github.gitdata.updateReference(
          context.repo({
            ref: 'refs/heads/kot',
            sha: commit.sha,
          })
        );
        console.log(a)
      });

    console.log(123123);
    return true;

    // await context.github.repos.merge(
    //   // {owner, repo, base, head, commit_message}
    //   context.repo({
    //     base: `refs/heads/test`,
    //     head: ref,
    //     commit_message: 'merge',
    //   })
    // );

    // app.log(`to create pullreq`);
    // await context.github.pullRequests.create(
    //   context.repo({
    //     title: 'test',
    //     body: 'test',
    //     head: 'refs/heads/test',
    //     base: 'refs/heads/master'
    //   })
    // );

    // owner: repo.owner.name,
    // repo: repo.name,
    // title: 'a',
    // body: 'i',
    // head: ref,
    // base: 'master'
    // context.github.
    // console.log(context.issue({body: 'a'}));
  });

  app.on('create', async context => {
    console.log(context.payload);
  });

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
