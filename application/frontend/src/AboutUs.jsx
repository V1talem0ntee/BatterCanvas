import "./App.css";
import { TEAM_INFORMATION } from './TeamInformation.jsx';
import TeamProfile from './TeamProfile.jsx';

function AboutUs() {
  return (
    <main>
      <h1>About Us</h1>

      <footer>
        {TEAM_INFORMATION.map((person) => (
            <TeamProfile 
            key={person.id} // React needs a unique key for list rendering
            image={person.image}
            name={person.name}
            role={person.role}
            description={person.description}
            />
        ))}
      </footer>

      <br />
    </main>
  );
}
export default AboutUs;
