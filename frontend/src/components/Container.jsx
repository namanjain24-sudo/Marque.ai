export function Container({ as: Tag = "div", className = "", children }) {
  return <Tag className={`mx-auto w-full max-w-(--container-page) px-5 sm:px-8 lg:px-10 ${className}`}>{children}</Tag>
}
