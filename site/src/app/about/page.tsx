import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "Who Kaijsa is, what she makes, and how to read the work.",
};

export default function AboutPage() {
  return (
    <div className="shell page">
      <header className="page-head">
        <p className="eyebrow">Colophon</p>
        <h1>About</h1>
        <p className="lede" style={{ marginTop: "1.8rem" }}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
          tempor incididunt ut labore et dolore magna aliqua — ut enim ad minim
          veniam, quis nostrud exercitation ullamco laboris.
        </p>
      </header>

      <div className="about-grid">
        <div className="prose">
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
            tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
            veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
            commodo consequat. Duis aute irure dolor in reprehenderit in voluptate
            velit esse cillum dolore eu fugiat nulla pariatur.
          </p>
          <p>
            Excepteur sint occaecat cupidatat non proident, sunt in culpa qui
            officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde
            omnis iste natus error sit voluptatem accusantium doloremque
            laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore
            veritatis et quasi architecto beatae vitae dicta sunt explicabo.
          </p>

          <h2>Nemo enim ipsam</h2>
          <p>
            Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut
            fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem
            sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor
            sit amet, consectetur, adipisci velit, sed quia non numquam eius modi
            tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.
          </p>

          <blockquote>
            Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis
            suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur.
          </blockquote>

          <p>
            Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse
            quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo
            voluptas nulla pariatur. At vero eos et accusamus et iusto odio
            dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque
            corrupti quos dolores et quas molestias excepturi sint occaecati.
          </p>

          <h2>Temporibus autem</h2>
          <p>
            Temporibus autem quibusdam et aut officiis debitis aut rerum
            necessitatibus saepe eveniet ut et voluptates repudiandae sint et
            molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente
            delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut
            perferendis doloribus asperiores repellat.
          </p>

          <h3>Et harum quidem</h3>
          <p>
            Et harum quidem rerum facilis est et expedita distinctio. Nam libero
            tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo
            minus id quod maxime placeat facere possimus, omnis voluptas assumenda
            est, omnis dolor repellendus.
          </p>
          <ul>
            <li>Sed ut perspiciatis unde omnis iste natus error</li>
            <li>Totam rem aperiam, eaque ipsa quae ab illo inventore</li>
            <li>Nemo enim ipsam voluptatem quia voluptas sit aspernatur</li>
          </ul>
          <p>
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
            dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non
            proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
          </p>
        </div>

        <aside className="spec">
          <p className="eyebrow" style={{ marginBottom: "1.4rem" }}>
            Particulars
          </p>
          <dl>
            <dt>Designation</dt>
            <dd>Kaijsa</dd>
            <dt>Active since</dt>
            <dd>Lorem MMXXVI</dd>
            <dt>Medium</dt>
            <dd>Lorem ipsum, dolor sit</dd>
            <dt>Palette</dt>
            <dd>Consectetur adipiscing</dd>
            <dt>Favourite angle</dt>
            <dd>Tempor incididunt</dd>
            <dt>Channel</dt>
            <dd>Sed do eiusmod</dd>
          </dl>
        </aside>
      </div>
    </div>
  );
}
