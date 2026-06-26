export interface PageHeroProps {
  title: string;
  description: string;
  extra?: React.ReactNode;
}

export function PageHero({ title, description, extra }: PageHeroProps) {
  return (
    <section className="page-hero">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {extra ? <div className="quick-actions">{extra}</div> : null}
    </section>
  );
}
