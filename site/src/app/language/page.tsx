import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Language",
  description: "Kaijsik language — lorem ipsum dolor sit amet.",
};

export default function LanguagePage() {
  return (
    <div className="shell page">
      <header className="page-head">
        <p className="eyebrow">Lexicon</p>
        <h1>Kaijsik language</h1>
        <p className="lede" style={{ marginTop: "1.8rem" }}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit — sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua, ut enim ad
          minim veniam.
        </p>
      </header>

      <div className="prose">
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod
          tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
          veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
          commodo consequat.
        </p>
        <p>
          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
          dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non
          proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
        </p>

        <h2>Sed ut perspiciatis</h2>
        <p>
          Sed ut perspiciatis unde omnis iste natus error sit voluptatem
          accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab
          illo inventore veritatis et quasi architecto beatae vitae dicta sunt
          explicabo.
        </p>
        <ul>
          <li>Nemo enim ipsam voluptatem quia voluptas</li>
          <li>Neque porro quisquam est qui dolorem ipsum</li>
          <li>Ut enim ad minima veniam, quis nostrum</li>
        </ul>

        <blockquote>
          Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse
          quam nihil molestiae consequatur.
        </blockquote>

        <h2>Temporibus autem</h2>
        <p>
          Temporibus autem quibusdam et aut officiis debitis aut rerum
          necessitatibus saepe eveniet ut et voluptates repudiandae sint et
          molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente
          delectus, ut aut reiciendis voluptatibus maiores alias consequatur.
        </p>
        <p>
          Et harum quidem rerum facilis est et expedita distinctio. Nam libero
          tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo
          minus id quod maxime placeat facere possimus, omnis voluptas assumenda
          est.
        </p>
      </div>
    </div>
  );
}
