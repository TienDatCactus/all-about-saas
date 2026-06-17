import { Column, Img, Link, Row, Section } from "react-email";

export default function Header() {
  return (
    <Section className="bg-bg mobile:px-2 px-6 py-4">
      <Row>
        <Column className="w-[80%]">
          <Img
            alt="logo"
            width={23}
            className="block"
            src="https://react.email/static/logo-without-background.png"
          />
        </Column>
        <Column align="right">
          <Row align="right">
            <Column>
              <Link href="#">
                <Img
                  alt="X"
                  className="mx-[4px]"
                  src="https://react.email/static/x-logo.png"
                  width={23}
                />
              </Link>
            </Column>
            <Column>
              <Link href="#">
                <Img
                  alt="Instagram"
                  className="mx-[4px]"
                  width={23}
                  src="https://react.email/static/instagram-logo.png"
                />
              </Link>
            </Column>
            <Column>
              <Link href="#">
                <Img
                  alt="Facebook"
                  className="mx-[4px]"
                  width={23}
                  src="https://react.email/static/facebook-logo.png"
                />
              </Link>
            </Column>
          </Row>
        </Column>
      </Row>
    </Section>
  );
}
