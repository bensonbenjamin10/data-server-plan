import { Link } from "react-router-dom";

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-2 text-sm text-text-muted">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span className="text-neutral-dark">/</span>}
          {item.path ? (
            <Link
              to={item.path}
              className="hover:text-accent transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-text font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
