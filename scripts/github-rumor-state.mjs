// Durable accounting, separate from the deployed branch. No credentials or post texts.
export function githubRumorState({token=process.env.GITHUB_TOKEN,repository=process.env.GITHUB_REPOSITORY,baseSha=process.env.GITHUB_SHA,fetchImpl=fetch}={}) {
  if (!token || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? '') || !/^[a-f0-9]{40}$/.test(baseSha ?? '')) throw Error('Missing GitHub state-store configuration.');
  const branch='ufcinfo-rumor-state',path='.github/rumor-sync-state.json';
  const base=`https://api.github.com/repos/${repository}`;
  let sha;
  async function request(path,method='GET',body) {
    const response=await fetchImpl(base+path,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(25000),redirect:'error'});
    if(response.status===404 && method==='GET')return null;
    if(!response.ok)throw Error(`GitHub state-store HTTP ${response.status}. No paid query permitted.`);
    return response.json();
  }
  return {
    async load() {
      let created=false;
      if (!await request(`/git/ref/heads/${branch}`)) {await request('/git/refs','POST',{ref:`refs/heads/${branch}`,sha:baseSha});created=true;}
      const file=await request(`/contents/${path}?ref=${branch}`);
      if (!file) {if(!created)throw Error('Accounting branch exists but ledger is missing. Refusing budget reset.');return null;}
      sha=file.sha;
      return JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
    },
    async save(state) {
      const metadata={schemaVersion:1,reservedCredits:state.reservedCredits,estimatedCredits:state.estimatedCredits,lastSuccessAt:state.lastSuccessAt,pending:state.pending,archive:[]};
      const result=await request(`/contents/${path}`,'PUT',{message:'chore: update durable rumor credit accounting',branch,content:Buffer.from(JSON.stringify(metadata,null,2)+'\n').toString('base64'),...(sha?{sha}:{})});
      if (!result.content?.sha)throw Error('GitHub did not confirm durable accounting.');
      sha=result.content.sha;
    },
  };
}
