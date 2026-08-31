// This function component is responsible for rendering the profile of a team member.
// It takes in props for the member's name, image, role, and description,
// and displays them in a structured format.
function TeamProfile({ name, image, role, description }) {
  return (
    <section>
        <img src={image}
         alt={name}
         className="profile-photo"
        />
        <h3>{name}</h3>
        <p>{role}</p>
        <p className="profile-description">{description}</p>
        <br />
        <br />
        <br />
    </section>
  );
}
export default TeamProfile;