import "./App.css";
import "./Home.css";
import { Link } from "react-router-dom";
import mapExample from "./assets/mapExample.png";
import plannerExample from "./assets/plannerExample.png";

function Home() {
  return (
    <main className="background">
    <div className="container">

    <section className="full-width-background home-hero" style={{ padding: '130px'}}>

      <div style={{ padding: '20px'}}>
        <h1>BigBacks Edu</h1>
        <p>
          <strong>The most efficient management solution for modern academia</strong>
        </p>
        <p>Built with administrators and students in mind</p>
      </div>

    </section>

<section className="home-intro-section" style={{ paddingTop: '100px', paddingBottom: '100px'}}>

    <section className="main-grid">
      <div className="text-box" style={{ background: 'linear-gradient(rgba(255, 255, 255, 0.69), rgb(255, 255, 255))' }}>
        <h2 align="left">Why BBEdu?</h2>
        <p>
         BigBacks Edu offers a comprehensive platform for students
         to manage their academic needs, and for administrators to manage
         their students. We offer an all in-one-solution
         with features such as course search, enrollment, profile management,
         and more! Our mission is to provide a seamless and efficient
         administrative and academic experience.
        </p>
      </div>

      <div className="feature-box">
        <h3 align="left">Getting Started</h3>
        <p>
          New to BBEdu? Create your administrative account today to get
          started with managing your platform.
        </p>
        <Link to="/signup" className="link-button">
          Sign Up
        </Link>
      </div>
    </section>
</section>

  <section className="full-width-background">
    <section className="bottom-grid">
      <h2 align="left">Unique Features</h2>
    </section>

<br />
<br />

    <section className="bottom-grid" style={{ maxWidth: '900px'}}>
      <div className="paragraph" style={{ maxWidth: '500px'}}>
        <strong >Campus Map Integration</strong>
        <p>
          Administrators can create and manage a customizable campus map
          for students to navigate the university.
          This way, students can easily visualize their
          pathway across campus between their classes.
        </p>
      </div>

      <div className="home-responsive-image" style={{ content: `url(${mapExample})`, maxWidth: '300px', maxHeight: '300px'}}>
        
      </div>
    </section>

<br />
<br />

    <section className="bottom-grid" style={{ maxWidth: '900px'}}>
      <div className="paragraph">
        <strong>Degree Planning Roadmap</strong>
        <p>
          Students have access to a unique degree planning roadmap
          that allows them to visualize their academic progress and plan
          their future courses. This feature helps students stay on track
          to graduate on time and make informed decisions about their academic journey.
        </p>
      </div>

    </section> 

    <section className="bottom-grid" style={{ maxWidth: '900px'}}>

      <div className="home-responsive-image" style={{ content: `url(${plannerExample})`, maxWidth: '1000px', maxHeight: '300px', minWidth: '100px'}}>
      </div>
      
    </section>    

<br />
<br />

    <section className="bottom-grid" style={{ maxWidth: '900px'}}>
      <div className="paragraph">
        <strong>Advanced Course Planning</strong>
        <p>
          Students are given advanced recommendations for their course planning based on
          their degree requirements and future academic goals. 
        </p>
      </div>

      
    </section>  
              


      <section className="bottom-grid home-info-grid" style={{ padding: '100px'}}>

        <div className="info-card">
          <h3>About Us</h3>
          <p>Learn more about our team and mission at BigBacks Edu.</p>
          <Link to="/about" className="link-button">Go to About Us →</Link>
        </div>

        <div className="info-card">
          <h3>Support & FAQ</h3>
          <p>Need help with enrollment? Take a look at our Frequently Asked Questions (FAQ) page.</p>
          <Link to="/faq" className="link-button">View FAQ →</Link>
        </div>


      </section>

      <br />
      <br />
      <br />


      <div>Copyright BigBacks Edu. All rights reserved.</div>

      <section className="main-grid">

      </section>
  </section>





      </div>
    </main>
  );
}
export default Home;

/*


      <div className="navigation-links">
        <Link to="/courses" className="btn-link">Course Search</Link>
        <Link to="/about" className="btn-link">About Us</Link>
      </div>

      */
