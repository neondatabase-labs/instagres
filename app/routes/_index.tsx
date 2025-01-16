const Home = () => (
	<div className="flex flex-col justify-center items-center min-h-screen p-6">
		<div>
			<h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-8 border-b pb-6">
				Instagres
			</h1>
			<div className="text-xl text-muted-foreground">
				<div className="my-4">
					<div>Instant Postgres.</div>
					<div>No signup required.</div>
				</div>
				<div className="my-4">
					Powered by{" "}
					<a
						className="underline text-foreground"
						href="https://neon.tech/signup?ref=instagres.com"
					>
						Neon
					</a>
					.
				</div>
				<div className="my-4 flex flex-wrap">
					<span className="mr-2">Here in your browser 🔮</span>
					<a className="underline text-foreground" href="/new">
						https://www.instagres.com/new
					</a>
				</div>
				<div className="my-4 flex items-center">
					<span className="mr-2 my-2">Or in your CLI 📺</span>
					<pre className="text-foreground px-3 py-1 rounded-sm bg-muted">
						npx instagres
					</pre>
				</div>
			</div>
		</div>
	</div>
);

export default Home;
