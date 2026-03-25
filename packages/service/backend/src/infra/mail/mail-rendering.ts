import { inline } from "@css-inline/css-inline";
import { origin } from "./mail";

export function renderMailHtml(content: string) {
  return prepare(`
		<!doctype html>
		<html>
			<head>
				<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1" />
				<base target="_blank" />
				<style>
					img {
						max-width: 100%;
						height: auto;
					}

					a {
						color: #0075ba;
						text-decoration: none;
					}

					a:hover {
						color: #00d3ff;
					}

					.button {
						font-size: 1.2rem;
						background: #0075ba;
						color: #fff !important;
						display: inline-block;
						border-radius: 3px;
						padding: 10px 30px;
						text-align: center;
						text-decoration: none;
						font-weight: bold;
					}

					.button:hover {
						background: #00d3ff;
					}
				</style>
			</head>
			<body
				style="
          font-family:
            ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji',
            'Segoe UI Symbol', 'Noto Color Emoji';
        "
			>
				<div class="wrapper" style="margin: 0 auto; max-width: 800px">
					<div class="header" style="display: flex; align-items: center; gap: 16px">
						<a href="${origin}">
							<img
								src="${absolute("/email-logo.png")}"
								alt="Contfu"
							/>
						</a>
						<span style="font-size: 3rem; font-weight: bold">Contfu</span>
					</div>
					<div class="main" style="margin-top: 20px; padding: 20px; background: #f5f8ff">
						${content}
					</div>
					<div
						class="footer"
						style="margin-top: 20px; padding: 20px; background: #eee; color: #777; text-align: center"
					>
						<p><a href="${origin}">Contfu</a>: Sync your content</p>
					</div>
				</div>
			</body>
		</html>
	`);
}

export function button(text: string, href: string) {
  return `<a role="button" class="button" href="${absolute(href)}">${text}</a>`;
}

export function link(text: string, href: string) {
  return `<a href="${absolute(href)}">${text}</a>`;
}

export function absolute(href: string) {
  return href.replace(/^\//, `${origin}/`);
}

function prepare(html: string) {
  const inlined = inline(html);
  return minify(inlined);
}

function minify(html: string) {
  return html
    .replace(/\s+/gm, " ")
    .replace(/> </g, "><")
    .replace(
      /style="([^"]*)"/g,
      (_, css) => `style="${css.replace(/; /g, ";").replace(/;$/, "")}"`,
    );
}
