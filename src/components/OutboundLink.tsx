interface Props {
  href: string;
  slug: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}

export function GithubLink({ href, slug, className, title, children }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      title={title}
      data-github-slug={slug.toLowerCase().slice(0, 64)}
    >
      {children}
    </a>
  );
}
