// Shared footer for login/auth pages (Login, ForgotPassword, SetPassword,
// AdminLogin). Matches the in-app footer in Layout.jsx so ownership and
// licensing look consistent everywhere.
//
// Kept as its own component so future edits happen in one place.
export function AuthFooter() {
  return (
    <footer className="site-footer auth-footer">
      <div className="container site-footer-inner">
        <span>© Malaga Ventures LLC. All rights reserved.</span>
        <span className="site-footer-right">
          <span>Standard issue license for Vine Group Inc.</span>
        </span>
      </div>
    </footer>
  )
}
