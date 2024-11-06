namespace SpoerStats2.Models
{
    public class User
    {
        public int Id { get; set; }
        public string FirstName { get; set; }
        public string LastName { get; set; }
        public int Age { get; set; }
        public string Email { get; set; }
        public string Password { get; set; }
        public string Gender { get; set; }
        public int RoleID { get; set; }
        public int ClubID { get; set; }
        public string profileImage_url { get; set; }

    }
}
