const Home = () => (
	<div className="flex flex-col justify-center items-center min-h-screen">
		<h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-7 border-b pb-5">
			Instagres
		</h1>
		<div className="text-xl text-muted-foreground">
			<div>Instant Postgres.</div>
			<div>No signup required.</div>
			<div className="mt-3">
				Powered by{" "}
				<a
					className="underline text-foreground"
					href="https://neon.tech/signup?ref=instagres.com"
				>
					Neon
				</a>
				.
			</div>
		</div>
	</div>
);

export default Home;
