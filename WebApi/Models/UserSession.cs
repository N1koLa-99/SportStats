
namespace SpoerStats2.Models
{
    public class UserSession
    {
        public UserSession(User dbUser) 
        {
            Id = dbUser.Id;
            FirstName=dbUser.FirstName;
            LastName=dbUser.LastName;
            Email=dbUser.Email;
            Gender=dbUser.Gender;
            RoleID=dbUser.RoleID;
            ClubID=dbUser.ClubID;
            profileImage_url=dbUser.profileImage_url;
            YearOfBirth = dbUser.YearOfBirth;

        }

        public int Id { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public string Email { get; set; }
        public string Gender { get; set; }
        public int RoleID { get; set; }
        public int ClubID { get; set; }
        public string UserTokenHash {  get; set; }
        public string profileImage_url { get; set; }
        public int YearOfBirth { get; set; }

        public string GetUserTokenHash()
        {
            string data = FirstName + LastName + Email + Gender + RoleID + ClubID + profileImage_url + Id + YearOfBirth;

            using (var sha256 = System.Security.Cryptography.SHA256.Create())
            {
                byte[] bytes = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(data));
                return Convert.ToBase64String(bytes);
            }

        }
    }
}
