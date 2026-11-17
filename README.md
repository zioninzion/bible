# Bible RcV

A static Bible reader with a responsive book library and reading view.

Serve the repository over HTTP for local development:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000 to go directly to the Bible reader. Deployments can
use any hostname or subdirectory. HTTPS (or localhost) is required for service
workers. Pages visited online are cached for later offline use; the entire Bible
is not downloaded automatically.

Run the runtime regression checks with Node.js:

```sh
node --test tests/*.cjs
```

Search supports exact phrases (`"living water"`), OR groups (`grace OR mercy`),
and exclusions (`love -world` or `love -"the world"`). Words in each OR group
must all match; exclusions apply within that group. Verse references such as
`John 3:16` or `Romans 8:1-11` display the requested passage directly, independent
of word-search filters. Each verse result can expand to show two surrounding
verses on either side. Search options include multiple books and chapter ranges.
Recent searches and frequently used book selections are stored in this browser;
use their Clear buttons to remove them. Search still works if browser storage
is unavailable.
