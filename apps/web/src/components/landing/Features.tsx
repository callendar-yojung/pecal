"use client";

import { useTranslations } from "next-intl";
import {
	FileText,
	KanbanSquare,
	Link2,
	Sparkles,
	ShieldCheck,
	Plug,
} from "lucide-react";

const featureKeys = [
	{ key: "docs", icon: FileText },
	{ key: "project", icon: KanbanSquare },
	{ key: "workspace", icon: Link2 },
	{ key: "ai", icon: Sparkles },
	{ key: "security", icon: ShieldCheck },
	{ key: "integrations", icon: Plug },
] as const;

export default function Features() {
	const t = useTranslations("features");

	return (
		<section id="features" className="py-20 md:py-32">
			<div className="mx-auto max-w-7xl px-6">
				<div className="mx-auto max-w-2xl text-center">
					<h2 className="mb-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
						{t("title")}
					</h2>
					<p className="text-lg text-muted-foreground">
						{t("description")}
					</p>
				</div>

				<div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
					{featureKeys.map(({ key, icon: Icon }) => (
						<article
							key={key}
							className="group rounded-2xl border border-border bg-background p-8 transition-all hover:border-border hover:shadow-lg"
						>
							<div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
								<Icon className="h-6 w-6 text-foreground" />
							</div>
							<h3 className="mb-2 text-xl font-semibold text-foreground">
								{t(`items.${key}.title`)}
							</h3>
							<p className="text-muted-foreground">
								{t(`items.${key}.description`)}
							</p>
						</article>
					))}
				</div>
			</div>
		</section>
	);
}
