const body = {
  repo: "example/hub",
  kind: "execution",
  id: `hub_${Date.now().toString(36)}`,
  payload: { source: "examples/05-hub-ingest", docker: false },
};
process.stdout.write(JSON.stringify(body, null, 2) + "\n");
if (!body.repo || !body.kind || !body.payload) process.exit(1);
